/**
 * Helper invoked when a Handoff transitions to ACCEPTED.
 * Creates the Customer + materializes OnboardingTask rows from the templates.
 * Idempotent — if a Customer already exists for the lead, returns it.
 */

import { OnboardingPhase, OnboardingTaskStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEAL_KIND_META } from "@/lib/pricing/deal-kinds";
import { templatesForKey } from "@/lib/onboarding/deal-kind-templates";

export async function createCustomerFromHandoff(opts: {
  leadId: string;
  acceptedByUserId: string;
}) {
  const existing = await prisma.customer.findUnique({ where: { leadId: opts.leadId } });
  if (existing) return existing;

  const lead = await prisma.lead.findUnique({
    where: { id: opts.leadId },
    select: { ownerUserId: true, dealKind: true },
  });
  if (!lead) throw new Error("Lead not found for handoff");

  // v2.16 — resolve real-user defaults per role:
  //   SALESPERSON → the lead's owner (so SP tasks land on the actual rep,
  //                  not the entire SP bucket which would notify everyone)
  //   VCIO        → the accepting user IF they're a VCIO (otherwise null;
  //                  any VCIO can pick it up via /my-tasks role bucket)
  //   SALES_MANAGER, COO → null; role bucket is the right grain.
  const acceptor = await prisma.user.findUnique({
    where: { id: opts.acceptedByUserId },
    select: { role: true },
  });
  // Local non-null reference for the closure (lead is guarded above).
  const leadOwnerId = lead.ownerUserId;
  function resolveOwnerForRole(role: Role | null | undefined): string | null {
    if (role === Role.SALESPERSON) return leadOwnerId;
    if (role === Role.VCIO && acceptor?.role === Role.VCIO) return opts.acceptedByUserId;
    return null;
  }

  // v2.15 — pick the template subset based on what was sold. Voice-only
  // deals don't need a NIST CSF assessment; cabling jobs don't need a
  // QBR cadence. Falls back to the full managed-IT stack if dealKind
  // somehow isn't set.
  const templateKey = DEAL_KIND_META[lead.dealKind]?.onboardingTemplateKey ?? "FULL_MANAGED_IT";
  const templates = templatesForKey(templateKey);

  const now = new Date();
  const customer = await prisma.$transaction(async (tx) => {
    const created = await tx.customer.create({
      data: {
        leadId: opts.leadId,
        accountManagerId: opts.acceptedByUserId, // default: the COO who accepted; reassignable later
        onboardingStartedAt: now,
        currentPhase: OnboardingPhase.PRE_ENGAGEMENT,
      },
    });

    // Group templates by phase to preserve ordering with a `position` index.
    const positionByPhase = new Map<OnboardingPhase, number>();
    const taskRows = templates.map((t) => {
      const pos = positionByPhase.get(t.phase) ?? 0;
      positionByPhase.set(t.phase, pos + 1);
      const dueAt = t.dueOffsetDays
        ? new Date(now.getTime() + t.dueOffsetDays * 24 * 60 * 60 * 1000)
        : null;
      return {
        customerId: created.id,
        phase: t.phase,
        title: t.title,
        description: t.description ?? null,
        position: pos,
        templateKey: t.key,
        dueAt,
        status: OnboardingTaskStatus.PENDING,
        ownerRole: t.defaultRole ?? null,
        // v2.16 — pin Salesperson tasks to the specific lead owner.
        ownerUserId: resolveOwnerForRole(t.defaultRole),
      };
    });
    await tx.onboardingTask.createMany({ data: taskRows });

    // v2.17 — migrate any pre-sale DiscoveryAssessments (lead-only) to also
    // reference the new Customer. We KEEP leadId for traceability so audit
    // queries can trace back to the originating lead. vCIO now sees the
    // pre-sale work they already did on /accounts/[customer], not just
    // on /leads/[id].
    await tx.discoveryAssessment.updateMany({
      where: { leadId: opts.leadId, customerId: null },
      data: { customerId: created.id },
    });

    return created;
  });

  return customer;
}

/**
 * Helper invoked when a Handoff transitions to ACCEPTED.
 * Creates the Customer + materializes OnboardingTask rows from the templates.
 * Idempotent — if a Customer already exists for the lead, returns it.
 */

import { OnboardingPhase, OnboardingTaskStatus } from "@prisma/client";
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
      };
    });
    await tx.onboardingTask.createMany({ data: taskRows });

    return created;
  });

  return customer;
}

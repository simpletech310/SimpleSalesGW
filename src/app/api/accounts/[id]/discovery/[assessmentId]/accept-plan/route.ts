import { NextResponse } from "next/server";
import { z } from "zod";
import { ActivityType, OnboardingPhase, OnboardingTaskStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

/**
 * v2.23 — POST /api/accounts/[id]/discovery/[assessmentId]/accept-plan
 *
 * Materializes the AI-generated vCIO plan into OnboardingTask rows on
 * the customer. RBAC: onboarding:manage (VCIO + SUPERADMIN + COO).
 *
 * Idempotent-with-flag: by default returns 409 if a plan was already
 * accepted; pass { replaceExisting: true } to delete prior
 * vcio-plan-<assessmentId>-* tasks and re-materialize.
 */

const TaskShape = z.object({
  phase: z.nativeEnum(OnboardingPhase),
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional().default(""),
  ownerRole: z.nativeEnum(Role).default(Role.VCIO),
  dueOffsetDays: z.number().int().min(0).max(3650).default(14),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  sourceFinding: z.string().max(500).optional(),
});

const BodySchema = z.object({
  replaceExisting: z.boolean().default(false),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; assessmentId: string }> },
) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "onboarding:manage")) throw new ApiError(403, "Forbidden");
    const { id: customerId, assessmentId } = await params;
    const body = BodySchema.parse(await req.json().catch(() => ({})));

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        leadId: true,
        onboardingStartedAt: true,
        currentPhase: true,
        // v3.3.7 — accountManager owns the customer relationship. We
        // route plan-task ownership to them when their role can take it,
        // otherwise fall back to the user who clicked Accept.
        accountManagerId: true,
        accountManager: { select: { id: true, role: true } },
      },
    });
    if (!customer) throw new ApiError(404, "Customer not found");

    const assessment = await prisma.discoveryAssessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        customerId: true,
        aiPlanSnapshot: true,
        planAcceptedAt: true,
      },
    });
    if (!assessment || assessment.customerId !== customerId) {
      throw new ApiError(404, "Assessment not found on this customer");
    }
    if (!assessment.aiPlanSnapshot) {
      throw new ApiError(409, "No AI plan generated yet — click Generate plan first.");
    }
    if (assessment.planAcceptedAt && !body.replaceExisting) {
      throw new ApiError(409, "Plan already accepted. Pass replaceExisting=true to re-accept.");
    }

    const snapshot = assessment.aiPlanSnapshot as Record<string, unknown>;
    const tasksRaw = Array.isArray(snapshot.recommendedTasks) ? snapshot.recommendedTasks : [];
    const tasks = z.array(TaskShape).parse(tasksRaw);
    // v3.3.7 — customerNextStep is a real action item ("send the SOW",
    // "schedule kickoff", etc.). Materialize it as a PRE_ENGAGEMENT task
    // so it shows up on the onboarding board alongside the plan tasks.
    const customerNextStep = typeof snapshot.customerNextStep === "string"
      ? snapshot.customerNextStep.trim()
      : "";

    const kickoff = customer.onboardingStartedAt ?? new Date();
    const templateKeyPrefix = `vcio-plan-${assessmentId}-`;

    // v3.3.7 — Resolve the owner for each task. Per-role mapping so a
    // task with ownerRole=SALESPERSON ends up with the lead's owner,
    // ownerRole=VCIO with the customer's accountManager (when they're
    // a VCIO), and ownerRole=COO unassigned (typically singular).
    const accountManager = customer.accountManager;
    const leadOwner = await prisma.lead.findUnique({
      where: { id: customer.leadId },
      select: { ownerUserId: true },
    });
    function ownerFor(role: Role | null): string | null {
      if (role === Role.SALESPERSON) return leadOwner?.ownerUserId ?? null;
      if (role === Role.VCIO) {
        if (accountManager?.role === Role.VCIO) return accountManager.id;
        // Fall back to the accepting user if THEY are vCIO
        return user.role === Role.VCIO ? user.id : null;
      }
      if (role === Role.COO) {
        return accountManager?.role === Role.COO
          ? accountManager.id
          : user.role === Role.COO
          ? user.id
          : null;
      }
      return null;
    }

    // If replacing, drop the prior vcio-plan-<assessmentId>-* tasks first.
    // We DON'T touch tasks created by other sources (template-driven, ad-hoc).
    if (body.replaceExisting) {
      await prisma.onboardingTask.deleteMany({
        where: { customerId, templateKey: { startsWith: templateKeyPrefix } },
      });
    }

    // Group by phase to assign monotonically increasing position values
    // (so the kanban-style phase columns render in plan order).
    const positionPerPhase = new Map<OnboardingPhase, number>();
    for (const phase of Object.values(OnboardingPhase)) positionPerPhase.set(phase, 0);

    // Existing max position per phase (so we append, not overlap, when
    // other tasks already exist in a phase).
    const existing = await prisma.onboardingTask.groupBy({
      by: ["phase"],
      where: { customerId },
      _max: { position: true },
    });
    for (const row of existing) {
      positionPerPhase.set(row.phase, (row._max.position ?? 0) + 1);
    }

    const rows = tasks.map((t, idx) => {
      const startPos = positionPerPhase.get(t.phase) ?? 0;
      positionPerPhase.set(t.phase, startPos + 1);
      const dueAt = new Date(kickoff.getTime() + t.dueOffsetDays * 24 * 60 * 60 * 1000);
      return {
        customerId,
        phase: t.phase,
        title: t.title,
        description: t.description || (t.sourceFinding ? `From assessment: ${t.sourceFinding}` : null),
        // v3.3.7 — assign to the right owner per role so /my-tasks lights up.
        ownerUserId: ownerFor(t.ownerRole),
        ownerRole: t.ownerRole,
        status: OnboardingTaskStatus.PENDING,
        dueAt,
        position: startPos,
        templateKey: `${templateKeyPrefix}${idx}`,
      };
    });

    // v3.3.7 — Append the customerNextStep as the first PRE_ENGAGEMENT
    // action item. Owned by the lead's salesperson when the next step
    // reads as a sales action ("send the SOW", "schedule signing call");
    // otherwise routed to the vCIO accountManager. Heuristic: anything
    // that mentions SOW / contract / sign / quote → SALESPERSON.
    if (customerNextStep) {
      const looksLikeSales = /\b(sow|contract|sign|signing|quote|proposal|kickoff call|kick off call|kick-off call)\b/i.test(customerNextStep);
      const nextStepRole = looksLikeSales ? Role.SALESPERSON : Role.VCIO;
      const nextStepOwner = ownerFor(nextStepRole);
      const nextStepDue = new Date(kickoff.getTime() + 3 * 24 * 60 * 60 * 1000);
      const phasePos = positionPerPhase.get(OnboardingPhase.PRE_ENGAGEMENT) ?? 0;
      positionPerPhase.set(OnboardingPhase.PRE_ENGAGEMENT, phasePos + 1);
      rows.push({
        customerId,
        phase: OnboardingPhase.PRE_ENGAGEMENT,
        title: `Customer next step: ${customerNextStep.slice(0, 240)}`,
        description: "Auto-created from the accepted vCIO plan. This is the customer-facing CTA — track it through to confirmation.",
        ownerUserId: nextStepOwner,
        ownerRole: nextStepRole,
        status: OnboardingTaskStatus.PENDING,
        dueAt: nextStepDue,
        position: phasePos,
        templateKey: `${templateKeyPrefix}next-step`,
      });
    }

    await prisma.$transaction([
      prisma.onboardingTask.createMany({ data: rows }),
      prisma.discoveryAssessment.update({
        where: { id: assessmentId },
        data: {
          planAcceptedAt: new Date(),
          planAcceptedByUserId: user.id,
          planAcceptedSnapshot: assessment.aiPlanSnapshot as never,
        },
      }),
      // Activity on the underlying lead for the timeline.
      prisma.activity.create({
        data: {
          leadId: customer.leadId,
          actorUserId: user.id,
          type: ActivityType.NOTE,
          subject: `vCIO plan accepted — ${rows.length} task${rows.length === 1 ? "" : "s"} added to onboarding`,
          body: snapshot.summary ? String(snapshot.summary).slice(0, 800) : null,
        },
      }),
    ]);

    // v3.3.7 — Count how many tasks landed on which user so the UI can
    // tell the accepter "5 of these are now on your /my-tasks" instead of
    // a generic "tasks added".
    const ownerCounts: Record<string, number> = {};
    for (const r of rows) {
      if (r.ownerUserId) ownerCounts[r.ownerUserId] = (ownerCounts[r.ownerUserId] ?? 0) + 1;
    }
    const tasksOnAccepter = ownerCounts[user.id] ?? 0;

    await writeAudit({
      actorUserId: user.id,
      entityType: "DiscoveryAssessment",
      entityId: assessmentId,
      action: "UPDATE",
      after: {
        planAccepted: true,
        tasksMaterialized: rows.length,
        replaceExisting: body.replaceExisting,
      },
      ...getAuditContext(req),
    });

    return NextResponse.json({
      ok: true,
      tasksCreated: rows.length,
      tasksOnAccepter,
      ownerCounts,
      acceptedAt: new Date().toISOString(),
    });
  } catch (err) {
    return jsonError(err);
  }
}

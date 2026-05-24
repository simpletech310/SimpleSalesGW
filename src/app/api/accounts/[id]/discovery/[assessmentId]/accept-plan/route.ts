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
        onboardingStartedAt: true,
        currentPhase: true,
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

    const kickoff = customer.onboardingStartedAt ?? new Date();
    const templateKeyPrefix = `vcio-plan-${assessmentId}-`;

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
        ownerUserId: null,
        ownerRole: t.ownerRole,
        status: OnboardingTaskStatus.PENDING,
        dueAt,
        position: startPos,
        templateKey: `${templateKeyPrefix}${idx}`,
      };
    });

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
          leadId: (await prisma.customer.findUnique({
            where: { id: customerId },
            select: { leadId: true },
          }))!.leadId,
          actorUserId: user.id,
          type: ActivityType.NOTE,
          subject: `vCIO plan accepted — ${rows.length} task${rows.length === 1 ? "" : "s"} added to onboarding`,
          body: snapshot.summary ? String(snapshot.summary).slice(0, 800) : null,
        },
      }),
    ]);

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
      acceptedAt: new Date().toISOString(),
    });
  } catch (err) {
    return jsonError(err);
  }
}

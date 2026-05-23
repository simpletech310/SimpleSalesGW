import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { buildTimeline } from "@/lib/timeline/stages";
import { evaluateAllGates } from "@/lib/pipeline/gates";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: {
        ownerUserId: true,
        pipelineStage: true,
        createdAt: true,
        actualCloseDate: true,
        customer: {
          select: { onboardingStartedAt: true, onboardingCompletedAt: true, onboardingTasks: { select: { phase: true, status: true } } },
        },
      },
    });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (lead.ownerUserId !== user.id && !can(user.role, "lead:view:all")) {
      throw new ApiError(403, "Forbidden");
    }

    // Derive current onboarding phase from tasks: latest phase with non-DONE/non-SKIPPED tasks.
    let onboarding = null as Awaited<ReturnType<typeof buildTimeline>>[number]["enteredAt"] extends infer T ? null | {
      phase: import("@prisma/client").OnboardingPhase;
      startedAt: Date | null;
      completedAt: Date | null;
    } : never;
    if (lead.customer) {
      const tasks = lead.customer.onboardingTasks;
      const phaseOrder: import("@prisma/client").OnboardingPhase[] = [
        "PRE_ENGAGEMENT", "DISCOVERY", "ONBOARD", "STABILIZE", "STEADY_STATE",
      ];
      let activePhase: import("@prisma/client").OnboardingPhase = phaseOrder[0]!;
      for (const p of phaseOrder) {
        const phaseTasks = tasks.filter((t) => t.phase === p);
        if (phaseTasks.length === 0) continue;
        const incomplete = phaseTasks.some((t) => t.status !== "DONE" && t.status !== "SKIPPED");
        if (incomplete) { activePhase = p; break; }
        activePhase = p; // last complete phase is the current marker
      }
      onboarding = {
        phase: activePhase,
        startedAt: lead.customer.onboardingStartedAt,
        completedAt: lead.customer.onboardingCompletedAt,
      };
    }

    const gates = await evaluateAllGates(id);

    const segments = buildTimeline({
      pipelineStage: lead.pipelineStage,
      leadCreatedAt: lead.createdAt,
      actualCloseDate: lead.actualCloseDate,
      onboarding,
      gates,
    });

    return NextResponse.json({ segments });
  } catch (err) {
    return jsonError(err);
  }
}

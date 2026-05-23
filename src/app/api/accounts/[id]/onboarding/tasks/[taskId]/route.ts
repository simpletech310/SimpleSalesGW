import { NextResponse } from "next/server";
import { z } from "zod";
import { OnboardingPhase, OnboardingTaskStatus, CustomerStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const patchSchema = z.object({
  status: z.nativeEnum(OnboardingTaskStatus).optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "onboarding:manage")) throw new ApiError(403, "Forbidden");
    const { id: customerId, taskId } = await params;
    const data = patchSchema.parse(await req.json());

    const existing = await prisma.onboardingTask.findUnique({ where: { id: taskId } });
    if (!existing || existing.customerId !== customerId) throw new ApiError(404, "Task not found");

    const updateData: Record<string, unknown> = { ...data };
    if (data.dueAt !== undefined) {
      updateData.dueAt = data.dueAt === null ? null : new Date(data.dueAt);
    }
    if (data.status === OnboardingTaskStatus.DONE && existing.status !== OnboardingTaskStatus.DONE) {
      updateData.completedAt = new Date();
    } else if (data.status && data.status !== OnboardingTaskStatus.DONE && existing.status === OnboardingTaskStatus.DONE) {
      updateData.completedAt = null;
    }

    const updated = await prisma.onboardingTask.update({ where: { id: taskId }, data: updateData });

    // Auto-advance phase + finish onboarding when last task done/skipped.
    if (data.status === OnboardingTaskStatus.DONE || data.status === OnboardingTaskStatus.SKIPPED) {
      const remaining = await prisma.onboardingTask.count({
        where: {
          customerId,
          phase: existing.phase,
          status: { notIn: [OnboardingTaskStatus.DONE, OnboardingTaskStatus.SKIPPED] },
        },
      });
      if (remaining === 0) {
        const next = nextPhase(existing.phase);
        if (next) {
          await prisma.customer.update({ where: { id: customerId }, data: { currentPhase: next } });
        }
        if (existing.phase === OnboardingPhase.STEADY_STATE) {
          // Still STEADY_STATE — no transition.
        } else if (existing.phase === OnboardingPhase.STABILIZE) {
          // Stabilize done → mark customer ACTIVE, stamp first QBR target.
          const c = await prisma.customer.findUnique({
            where: { id: customerId },
            select: { qbrFrequencyDays: true },
          });
          const nextQbrAt = c
            ? new Date(Date.now() + c.qbrFrequencyDays * 24 * 60 * 60 * 1000)
            : null;
          await prisma.customer.update({
            where: { id: customerId },
            data: {
              status: CustomerStatus.ACTIVE,
              onboardingCompletedAt: new Date(),
              currentPhase: OnboardingPhase.STEADY_STATE,
              nextQbrAt,
            },
          });
        }
      }
    }

    await writeAudit({
      actorUserId: user.id,
      entityType: "OnboardingTask",
      entityId: taskId,
      action: "UPDATE",
      before: { status: existing.status, ownerUserId: existing.ownerUserId, title: existing.title },
      after: data,
      ...getAuditContext(req),
    });

    return NextResponse.json({ task: updated });
  } catch (err) {
    return jsonError(err);
  }
}

function nextPhase(p: OnboardingPhase): OnboardingPhase | null {
  switch (p) {
    case OnboardingPhase.PRE_ENGAGEMENT: return OnboardingPhase.DISCOVERY;
    case OnboardingPhase.DISCOVERY: return OnboardingPhase.ONBOARD;
    case OnboardingPhase.ONBOARD: return OnboardingPhase.STABILIZE;
    case OnboardingPhase.STABILIZE: return OnboardingPhase.STEADY_STATE;
    default: return null;
  }
}


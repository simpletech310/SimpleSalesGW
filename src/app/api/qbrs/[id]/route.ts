import { NextResponse } from "next/server";
import { z } from "zod";
import { OnboardingPhase, OnboardingTaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const followUpSchema = z.object({
  description: z.string().min(1),
  ownerUserId: z.string().uuid().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

const schema = z.object({
  agenda: z.array(z.object({ title: z.string(), notes: z.string().optional() })).optional(),
  attendees: z.array(z.object({ name: z.string(), role: z.string().optional(), email: z.string().email().optional() })).optional(),
  outcomes: z.string().max(20_000).nullable().optional(),
  followUps: z.array(followUpSchema).optional(),
  scheduledAt: z.string().datetime().optional(),
  completed: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "qbr:complete") && !can(user.role, "qbr:schedule")) {
      throw new ApiError(403, "Forbidden");
    }
    const { id } = await params;
    const body = schema.parse(await req.json());

    const existing = await prisma.qbr.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "QBR not found");

    const updateData: Record<string, unknown> = {};
    if (body.agenda) updateData.agenda = body.agenda as never;
    if (body.attendees) updateData.attendees = body.attendees as never;
    if (body.outcomes !== undefined) updateData.outcomes = body.outcomes;
    if (body.followUps) updateData.followUps = body.followUps as never;
    if (body.scheduledAt) updateData.scheduledAt = new Date(body.scheduledAt);
    if (body.completed) updateData.completedAt = new Date();

    const updated = await prisma.qbr.update({ where: { id }, data: updateData });

    // When the QBR transitions to completed, materialize every follow-up as
    // an OnboardingTask row in STEADY_STATE phase. Uses the request's
    // followUps when provided, otherwise falls back to whatever's already
    // stored on the QBR. Idempotent via templateKey check.
    const isCompletionTransition = body.completed && !existing.completedAt;
    if (isCompletionTransition) {
      const followUps = body.followUps
        ?? (Array.isArray(existing.followUps) ? existing.followUps as Array<{ description: string; ownerUserId?: string | null; dueAt?: string | null }> : []);
      if (followUps.length > 0) {
        const templateKeyPrefix = `qbr-followup-${id.slice(0, 8)}`;
        // Don't double-create if a prior request already materialized them.
        const alreadyMaterialized = await prisma.onboardingTask.count({
          where: { customerId: existing.customerId, templateKey: { startsWith: templateKeyPrefix } },
        });
        if (alreadyMaterialized === 0) {
          const positionOffset = await prisma.onboardingTask.count({
            where: { customerId: existing.customerId, phase: OnboardingPhase.STEADY_STATE },
          });
          await prisma.onboardingTask.createMany({
            data: followUps.map((f, i) => ({
              customerId: existing.customerId,
              phase: OnboardingPhase.STEADY_STATE,
              title: f.description,
              description: "Auto-created from QBR follow-up. Edit or reassign as needed.",
              ownerUserId: f.ownerUserId ?? null,
              dueAt: f.dueAt ? new Date(f.dueAt) : null,
              position: positionOffset + i,
              templateKey: `${templateKeyPrefix}-${i}`,
              status: OnboardingTaskStatus.PENDING,
            })),
          });
        }
      }
    }

    await writeAudit({
      actorUserId: user.id,
      entityType: "Qbr",
      entityId: id,
      action: "UPDATE",
      after: { completed: !!body.completed, followUpCount: body.followUps?.length ?? 0 },
      ...getAuditContext(req),
    });

    return NextResponse.json({ qbr: updated });
  } catch (err) {
    return jsonError(err);
  }
}

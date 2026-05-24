import { NextResponse } from "next/server";
import { z } from "zod";
import { OnboardingPhase, OnboardingTaskStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can, canSeeCustomer } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { lead: { select: { ownerUserId: true } } },
    });
    if (!customer) throw new ApiError(404, "Customer not found");
    if (!canSeeCustomer(user.role, user.id, customer.lead.ownerUserId)) {
      throw new ApiError(403, "Forbidden");
    }
    const tasks = await prisma.onboardingTask.findMany({
      where: { customerId: id },
      orderBy: [{ phase: "asc" }, { position: "asc" }],
      include: { owner: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ tasks });
  } catch (err) {
    return jsonError(err);
  }
}

const createSchema = z.object({
  phase:       z.nativeEnum(OnboardingPhase),
  title:       z.string().min(1).max(300),
  description: z.string().max(4000).optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  ownerRole:   z.nativeEnum(Role).nullable().optional(),
  dueAt:       z.string().datetime().nullable().optional(),
});

/**
 * POST /api/accounts/[id]/onboarding/tasks
 * Add an ad-hoc onboarding task outside the template / QBR flow.
 * RBAC: onboarding:manage.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "onboarding:manage")) {
      throw new ApiError(403, "Forbidden — onboarding:manage required.");
    }
    const { id } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { id: true, lead: { select: { ownerUserId: true } } },
    });
    if (!customer) throw new ApiError(404, "Customer not found");
    if (!canSeeCustomer(user.role, user.id, customer.lead.ownerUserId)) {
      throw new ApiError(403, "Forbidden");
    }

    const data = createSchema.parse(await req.json());
    const positionOffset = await prisma.onboardingTask.count({
      where: { customerId: id, phase: data.phase },
    });

    const task = await prisma.onboardingTask.create({
      data: {
        customerId: id,
        phase: data.phase,
        title: data.title,
        description: data.description ?? null,
        ownerUserId: data.ownerUserId ?? null,
        ownerRole: data.ownerRole ?? null,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        position: positionOffset,
        templateKey: `ad-hoc-${Date.now()}`,
        status: OnboardingTaskStatus.PENDING,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "OnboardingTask",
      entityId: task.id,
      action: "CREATE",
      after: { customerId: id, phase: task.phase, title: task.title, adHoc: true },
      ...getAuditContext(req),
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

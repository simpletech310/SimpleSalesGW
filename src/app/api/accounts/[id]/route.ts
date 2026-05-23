import { NextResponse } from "next/server";
import { z } from "zod";
import { CustomerStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { canSeeCustomer, can } from "@/lib/rbac";
import { writeAudit, diffForAudit } from "@/lib/audit";

const patchSchema = z.object({
  accountManagerId: z.string().uuid().nullable().optional(),
  status: z.nativeEnum(CustomerStatus).optional(),
  qbrFrequencyDays: z.coerce.number().int().min(7).max(365).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        lead: {
          include: {
            owner: { select: { id: true, name: true, email: true } },
          },
        },
        accountManager: { select: { id: true, name: true, email: true } },
        discoveryAssessments: {
          orderBy: { createdAt: "desc" },
          include: { createdBy: { select: { name: true } } },
        },
        qbrs: { orderBy: { scheduledAt: "desc" }, take: 20 },
      },
    });
    if (!customer) throw new ApiError(404, "Customer not found");
    if (!canSeeCustomer(user.role, user.id, customer.lead.ownerUserId)) {
      throw new ApiError(403, "Forbidden");
    }
    return NextResponse.json({ customer });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "onboarding:manage")) throw new ApiError(403, "Forbidden");
    const { id } = await params;
    const before = await prisma.customer.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "Customer not found");
    const data = patchSchema.parse(await req.json());
    const after = await prisma.customer.update({ where: { id }, data });
    const diff = diffForAudit(before as unknown as Record<string, unknown>, data as unknown as Record<string, unknown>);
    await writeAudit({
      actorUserId: user.id,
      entityType: "Customer",
      entityId: id,
      action: "UPDATE",
      before: diff.before as never,
      after: diff.after as never,
      ...getAuditContext(req),
    });
    return NextResponse.json({ customer: after });
  } catch (err) {
    return jsonError(err);
  }
}

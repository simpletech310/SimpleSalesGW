import { NextResponse } from "next/server";
import { z } from "zod";
import { CustomerStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  status: z.enum([CustomerStatus.CHURNED, CustomerStatus.PAUSED]),
  reason: z.string().min(1).max(2000),
});

/**
 * POST /api/accounts/[id]/archive
 * Marks a Customer as CHURNED or PAUSED with a required reason.
 * RBAC: customer:archive.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "customer:archive")) {
      throw new ApiError(403, "Forbidden — customer:archive required.");
    }
    const { id } = await params;
    const { status, reason } = schema.parse(await req.json());

    const existing = await prisma.customer.findUnique({
      where: { id },
      select: { status: true, archivedAt: true, lead: { select: { businessName: true } } },
    });
    if (!existing) throw new ApiError(404, "Customer not found");
    if (existing.archivedAt) {
      throw new ApiError(409, "Customer is already archived. Reactivate first if you want to re-archive.");
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        status,
        archivedAt: new Date(),
        archivedReason: reason,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "Customer",
      entityId: id,
      action: "UPDATE",
      before: { status: existing.status, archivedAt: null },
      after: { status: updated.status, archivedAt: updated.archivedAt?.toISOString(), reason },
      ...getAuditContext(req),
    });

    return NextResponse.json({ customer: updated });
  } catch (err) {
    return jsonError(err);
  }
}

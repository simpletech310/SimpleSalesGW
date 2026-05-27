import { NextResponse } from "next/server";
import { z } from "zod";
import { PipelineStage, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

/**
 * Bulk-reassign every open lead owned by `id` to another rep. Closed
 * (CLOSED_WON / CLOSED_LOST) leads stay attached to the original rep so
 * commission history remains intact. Records one UPDATE audit row per
 * lead so the reassignment is fully traceable.
 *
 * Authorized for SALES_MANAGER (lead:assign) or SUPERADMIN.
 */
const schema = z.object({
  toUserId: z.string().min(1),
});

const CLOSED_STAGES: PipelineStage[] = [PipelineStage.CLOSED_WON, PipelineStage.CLOSED_LOST];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSessionUser();
    if (!can(actor.role, "lead:assign") && !can(actor.role, "user:manage")) {
      throw new ApiError(403, "Forbidden");
    }
    const { id: fromUserId } = await params;
    const { toUserId } = schema.parse(await req.json());

    if (fromUserId === toUserId) {
      throw new ApiError(400, "Source and destination rep must differ");
    }

    const [from, to] = await Promise.all([
      prisma.user.findUnique({ where: { id: fromUserId }, select: { id: true, name: true, role: true } }),
      prisma.user.findUnique({ where: { id: toUserId }, select: { id: true, name: true, role: true, active: true } }),
    ]);
    if (!from) throw new ApiError(404, "Source rep not found");
    if (!to || !to.active) throw new ApiError(400, "Destination rep is inactive or missing");
    if (to.role !== Role.SALESPERSON) {
      throw new ApiError(400, "Destination must be a salesperson");
    }

    const leads = await prisma.lead.findMany({
      where: { ownerUserId: fromUserId, pipelineStage: { notIn: CLOSED_STAGES } },
      select: { id: true, businessName: true },
    });

    if (leads.length === 0) {
      return NextResponse.json({ moved: 0, message: "No open leads to reassign." });
    }

    await prisma.$transaction([
      prisma.lead.updateMany({
        where: { id: { in: leads.map((l) => l.id) } },
        data: { ownerUserId: toUserId },
      }),
    ]);

    // Audit per lead so the move shows up in each lead's history.
    await Promise.all(
      leads.map((l) =>
        writeAudit({
          actorUserId: actor.id,
          entityType: "Lead",
          entityId: l.id,
          action: "UPDATE",
          before: { ownerUserId: fromUserId } as never,
          after: { ownerUserId: toUserId } as never,
          ...getAuditContext(req),
        }),
      ),
    );

    return NextResponse.json({
      moved: leads.length,
      from: from.name,
      to: to.name,
    });
  } catch (err) {
    return jsonError(err);
  }
}

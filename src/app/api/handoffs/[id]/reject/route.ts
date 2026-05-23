import { NextResponse } from "next/server";
import { z } from "zod";
import { ActivityType, HandoffStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ reason: z.string().min(1).max(2000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "handoff:accept")) throw new ApiError(403, "Forbidden");
    const { id } = await params;
    const handoff = await prisma.handoff.findUnique({ where: { id } });
    if (!handoff) throw new ApiError(404, "Handoff not found");
    if (handoff.status !== HandoffStatus.INITIATED) {
      throw new ApiError(409, `Already ${handoff.status.toLowerCase()}`);
    }
    const body = schema.parse(await req.json());

    const updated = await prisma.handoff.update({
      where: { id },
      data: {
        status: HandoffStatus.REJECTED,
        acceptorUserId: user.id,
        rejectedAt: new Date(),
        rejectedReason: body.reason,
      },
    });
    await prisma.activity.create({
      data: {
        leadId: handoff.leadId,
        actorUserId: user.id,
        type: ActivityType.HANDOFF_ACCEPTED, // (no HANDOFF_REJECTED enum yet; subject distinguishes)
        subject: "Sales-to-Ops handoff rejected",
        body: body.reason,
      },
    });
    await writeAudit({
      actorUserId: user.id,
      entityType: "Handoff",
      entityId: id,
      action: "REJECT",
      before: { status: handoff.status },
      after: { status: HandoffStatus.REJECTED, rejectedReason: body.reason },
      ...getAuditContext(req),
    });
    return NextResponse.json({ handoff: updated });
  } catch (err) {
    return jsonError(err);
  }
}

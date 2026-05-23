import { NextResponse } from "next/server";
import { z } from "zod";
import { ActivityType, HandoffStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  leadId: z.string().uuid(),
  payload: z.record(z.unknown()),
  notes: z.string().max(20_000).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "handoff:initiate")) throw new ApiError(403, "Forbidden");
    const data = schema.parse(await req.json());

    const lead = await prisma.lead.findUnique({ where: { id: data.leadId } });
    if (!lead) throw new ApiError(404, "Lead not found");

    const handoff = await prisma.handoff.create({
      data: {
        leadId: data.leadId,
        initiatorUserId: user.id,
        status: HandoffStatus.INITIATED,
        payload: data.payload as never,
        notes: data.notes ?? null,
        initiatedAt: new Date(),
      },
    });

    await prisma.activity.create({
      data: {
        leadId: data.leadId,
        actorUserId: user.id,
        type: ActivityType.HANDOFF_INITIATED,
        subject: "Sales-to-Ops handoff initiated",
        body: data.notes ?? null,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "Handoff",
      entityId: handoff.id,
      action: "CREATE",
      after: { leadId: data.leadId, status: HandoffStatus.INITIATED },
      ...getAuditContext(req),
    });

    return NextResponse.json({ handoff }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

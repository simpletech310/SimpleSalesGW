import { NextResponse } from "next/server";
import { z } from "zod";
import { ActivityOutcome, ActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  type: z.nativeEnum(ActivityType),
  subject: z.string().min(1).max(300),
  body: z.string().max(20_000).optional(),
  outcome: z.nativeEnum(ActivityOutcome).optional(),
  nextAction: z.string().max(300).optional(),
  nextActionDueAt: z.string().datetime().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const data = schema.parse(await req.json());

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (lead.ownerUserId !== user.id && !can(user.role, "lead:edit:any") && !can(user.role, "lead:edit:scope-notes")) {
      throw new ApiError(403, "Forbidden");
    }

    const activity = await prisma.activity.create({
      data: {
        leadId: id,
        actorUserId: user.id,
        type: data.type,
        subject: data.subject,
        body: data.body ?? null,
        outcome: data.outcome ?? null,
        nextAction: data.nextAction ?? null,
        nextActionDueAt: data.nextActionDueAt ? new Date(data.nextActionDueAt) : null,
      },
    });
    await writeAudit({
      actorUserId: user.id,
      entityType: "Activity",
      entityId: activity.id,
      action: "CREATE",
      after: activity as unknown as Record<string, unknown>,
      ...getAuditContext(req),
    });
    return NextResponse.json({ activity }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

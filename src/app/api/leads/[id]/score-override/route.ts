import { NextResponse } from "next/server";
import { z } from "zod";
import { ActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { SCORING_DEFAULTS } from "@/lib/scoring/engine";

const schema = z.object({
  servicesScore: z.coerce.number().int().min(0).max(100),
  customerScore: z.coerce.number().int().min(0).max(100),
  dealQualityScore: z.coerce.number().int().min(0).max(100),
  reason: z.string().min(1).max(2000),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "score:override")) throw new ApiError(403, "Forbidden");
    const { id } = await params;
    const data = schema.parse(await req.json());

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new ApiError(404, "Lead not found");

    const before = {
      servicesScore: lead.servicesScore,
      customerScore: lead.customerScore,
      dealQualityScore: lead.dealQualityScore,
      nonStrategicFlag: lead.nonStrategicFlag,
    };

    const nonStrategicFlag =
      data.servicesScore < SCORING_DEFAULTS.nonStrategic.servicesBelow ||
      data.dealQualityScore < SCORING_DEFAULTS.nonStrategic.dealQualityBelow;

    const after = await prisma.lead.update({
      where: { id },
      data: {
        servicesScore: data.servicesScore,
        customerScore: data.customerScore,
        dealQualityScore: data.dealQualityScore,
        nonStrategicFlag,
      },
    });

    await prisma.activity.create({
      data: {
        leadId: id,
        actorUserId: user.id,
        type: ActivityType.SCORE_CHANGE,
        subject: `Scores overridden by ${user.name}`,
        body: `Reason: ${data.reason}\n\nServices ${lead.servicesScore} → ${data.servicesScore}\nCustomer ${lead.customerScore} → ${data.customerScore}\nDeal Quality ${lead.dealQualityScore} → ${data.dealQualityScore}`,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: id,
      action: "UPDATE",
      before,
      after: {
        servicesScore: after.servicesScore,
        customerScore: after.customerScore,
        dealQualityScore: after.dealQualityScore,
        nonStrategicFlag,
        overrideReason: data.reason,
      },
      ...getAuditContext(req),
    });

    return NextResponse.json({ lead: after });
  } catch (err) {
    return jsonError(err);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { ActivityType, PipelineStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ stage: z.nativeEnum(PipelineStage), reason: z.string().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const { stage, reason } = schema.parse(await req.json());

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (lead.ownerUserId !== user.id && !can(user.role, "lead:edit:any")) {
      throw new ApiError(403, "Forbidden");
    }

    // Non-strategic deals cannot advance past PROPOSAL without manager approval.
    const advancedStages: PipelineStage[] = [PipelineStage.NEGOTIATION, PipelineStage.CLOSED_WON];
    const earlyStages: PipelineStage[] = [
      PipelineStage.LEAD, PipelineStage.QUALIFIED, PipelineStage.DISCOVERY,
      PipelineStage.PRE_SALES, PipelineStage.PROPOSAL,
    ];
    const advancing = advancedStages.includes(stage) && earlyStages.includes(lead.pipelineStage);
    if (lead.nonStrategicFlag && advancing && !lead.nonStrategicApprovalUserId) {
      if (!can(user.role, "deal:approve:non-strategic")) {
        throw new ApiError(403, "Non-strategic deal requires Sales Manager approval to advance past Proposal.");
      }
      await prisma.lead.update({
        where: { id },
        data: {
          nonStrategicApprovalUserId: user.id,
          nonStrategicApprovalReason: reason ?? "Approved on stage advance",
        },
      });
    }

    const before = lead.pipelineStage;
    await prisma.lead.update({ where: { id }, data: { pipelineStage: stage } });
    await prisma.activity.create({
      data: {
        leadId: id,
        actorUserId: user.id,
        type: ActivityType.STAGE_CHANGE,
        subject: `Stage: ${before} → ${stage}`,
        body: reason ?? null,
      },
    });
    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: id,
      action: "UPDATE",
      before: { pipelineStage: before },
      after: { pipelineStage: stage },
      ...getAuditContext(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

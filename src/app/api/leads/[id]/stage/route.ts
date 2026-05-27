import { NextResponse } from "next/server";
import { z } from "zod";
import { ActivityType, PipelineStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { evaluateGate } from "@/lib/pipeline/gates";

const schema = z.object({
  stage: z.nativeEnum(PipelineStage),
  reason: z.string().optional(),
  /** When true, the client has acknowledged any gate warnings and wants to proceed. */
  acknowledgeWarnings: z.boolean().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const { stage, reason, acknowledgeWarnings } = schema.parse(await req.json());

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (lead.ownerUserId !== user.id && !can(user.role, "lead:edit:any")) {
      throw new ApiError(403, "Forbidden");
    }

    // Non-strategic deals cannot advance past Quote Sent without manager
    // approval.
    const advancedStages: PipelineStage[] = [PipelineStage.NEGOTIATION, PipelineStage.CLOSED_WON];
    const earlyStages: PipelineStage[] = [
      PipelineStage.LEAD, PipelineStage.QUALIFIED,
      PipelineStage.FIRST_INTERACTION, PipelineStage.SITE_SURVEY_SCHEDULED,
      PipelineStage.DISCOVERY,
      PipelineStage.QUOTE_IN_PROGRESS, PipelineStage.QUOTE_SENT,
    ];
    const advancing = advancedStages.includes(stage) && earlyStages.includes(lead.pipelineStage);
    if (lead.nonStrategicFlag && advancing && !lead.nonStrategicApprovalUserId) {
      if (!can(user.role, "deal:approve:non-strategic")) {
        throw new ApiError(403, "Non-strategic deal requires Sales Manager approval to advance past Quote Sent.");
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

    // v3.4 — Only managers + vCIO + COO can move a lead INTO Quote in Progress.
    // Reps must request a quote from the manager/vCIO.
    if (stage === PipelineStage.QUOTE_IN_PROGRESS && !can(user.role, "quote:create")) {
      return NextResponse.json(
        {
          ok: false,
          reasons: [
            "Sales reps can't create quotes. Use the lead page to request a quote from your Sales Manager or vCIO.",
          ],
          stage,
          before,
        },
        { status: 422 },
      );
    }

    // Phase gates — hard blocks return 422 (no override); warnings return
    // 409 and let the client retry with acknowledgeWarnings=true.
    const { warnings, hardBlocks } = await evaluateGate(id, before, stage);
    if (hardBlocks.length > 0) {
      return NextResponse.json({ ok: false, reasons: hardBlocks, stage, before }, { status: 422 });
    }
    if (warnings.length > 0 && !acknowledgeWarnings) {
      return NextResponse.json({ ok: false, warnings, stage, before }, { status: 409 });
    }

    // Persist close date + reason when entering a terminal state.
    const terminalUpdate: Record<string, unknown> = { pipelineStage: stage };
    if (stage === PipelineStage.CLOSED_WON || stage === PipelineStage.CLOSED_LOST) {
      terminalUpdate.actualCloseDate = new Date();
    }
    if (stage === PipelineStage.CLOSED_LOST && reason) {
      terminalUpdate.closedLostReason = reason;
    }
    await prisma.lead.update({ where: { id }, data: terminalUpdate });
    await prisma.activity.create({
      data: {
        leadId: id,
        actorUserId: user.id,
        type: ActivityType.STAGE_CHANGE,
        subject: `Stage: ${before} → ${stage}`,
        body: [reason, warnings.length > 0 ? `Proceeded past gate warnings: ${warnings.join(" | ")}` : null]
          .filter(Boolean).join("\n\n") || null,
      },
    });
    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: id,
      action: "UPDATE",
      before: { pipelineStage: before },
      after: { pipelineStage: stage, gateWarnings: warnings.length > 0 ? warnings : undefined },
      ...getAuditContext(req),
    });
    return NextResponse.json({ ok: true, warnings });
  } catch (err) {
    return jsonError(err);
  }
}

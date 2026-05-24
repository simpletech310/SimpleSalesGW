import { NextResponse } from "next/server";
import { DiscoveryStatus, ResearchArtifactType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can, leadIsVisible } from "@/lib/rbac";
import { userTeamIds } from "@/lib/sales/teams";
import { writeAudit } from "@/lib/audit";
import { generateVcioPlan } from "@/lib/ai/vcio-recommendations";
import { AnthropicNotConfiguredError, isAnthropicConfigured } from "@/lib/ai/anthropic";
import { AiBudgetExceededError } from "@/lib/ai/budget";

/**
 * v2.23 — POST /api/leads/[id]/discovery/[assessmentId]/vcio-plan
 *
 * Pre-handoff mirror of the accounts-side route. Lets the SE/vCIO run
 * a plan against a pre-sale assessment on a Lead.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; assessmentId: string }> },
) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "discovery:edit")) throw new ApiError(403, "Forbidden");
    const { id: leadId, assessmentId } = await params;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        ownerUserId: true,
        pipelineStage: true,
        teamId: true,
        businessName: true,
        industry: true,
        seatCount: true,
        addressCity: true,
        addressState: true,
        complianceDrivers: true,
        currentMspName: true,
      },
    });
    if (!lead) throw new ApiError(404, "Lead not found");
    const teams = await userTeamIds(user.id);
    if (!leadIsVisible(user.role, user.id, lead.ownerUserId, lead.pipelineStage, lead.teamId, teams)) {
      throw new ApiError(403, "Forbidden");
    }

    const assessment = await prisma.discoveryAssessment.findUnique({
      where: { id: assessmentId },
      select: { id: true, leadId: true, kind: true, status: true, answers: true, scorecard: true },
    });
    if (!assessment || assessment.leadId !== leadId) {
      throw new ApiError(404, "Assessment not found");
    }
    if (assessment.status !== DiscoveryStatus.COMPLETED) {
      throw new ApiError(409, "Assessment must be completed before generating a plan.");
    }

    if (!isAnthropicConfigured()) throw new AnthropicNotConfiguredError();

    const plan = await generateVcioPlan(
      {
        context: {
          businessName: lead.businessName,
          industry: String(lead.industry),
          seatCount: lead.seatCount,
          addressCity: lead.addressCity,
          addressState: lead.addressState,
          complianceDrivers: lead.complianceDrivers.map(String),
          currentMspName: lead.currentMspName,
        },
        assessment: {
          kind: String(assessment.kind),
          scorecard: assessment.scorecard as Record<string, unknown> | null,
          answers: (assessment.answers ?? {}) as Record<string, unknown>,
        },
      },
      { leadId, userId: user.id },
    );

    const snapshot = {
      summary: plan.summary,
      recommendedTasks: plan.recommendedTasks,
      recommendedServices: plan.recommendedServices,
      risks: plan.risks,
      customerNextStep: plan.customerNextStep,
      generatedAt: new Date().toISOString(),
      generatedByUserId: user.id,
    };

    await prisma.discoveryAssessment.update({
      where: { id: assessmentId },
      data: { aiPlanSnapshot: snapshot as never, aiPlanGeneratedAt: new Date() },
    });

    await prisma.researchArtifact.create({
      data: {
        leadId,
        type: ResearchArtifactType.VCIO_RECOMMENDATION,
        sourceUrl: null,
        payload: { ...snapshot, assessmentId } as never,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "DiscoveryAssessment",
      entityId: assessmentId,
      action: "UPDATE",
      after: { vcioPlanGenerated: true, taskCount: plan.recommendedTasks.length },
      ...getAuditContext(req),
    });

    return NextResponse.json(snapshot);
  } catch (err) {
    if (err instanceof AnthropicNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof AiBudgetExceededError) {
      return NextResponse.json(
        { error: err.message, scope: err.scope, reason: err.reason },
        { status: 429 },
      );
    }
    return jsonError(err);
  }
}

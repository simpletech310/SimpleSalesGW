import { NextResponse } from "next/server";
import { ResearchArtifactType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { leadIsVisible } from "@/lib/rbac";
import { userTeamIds } from "@/lib/sales/teams";
import { coachSale } from "@/lib/ai/sales-coach";
import { AnthropicNotConfiguredError, isAnthropicConfigured } from "@/lib/ai/anthropic";
import { AiBudgetExceededError } from "@/lib/ai/budget";
import { writeAudit } from "@/lib/audit";

/**
 * v2.22 — POST /api/leads/[id]/coach
 *
 * AI sales coach for a specific deal. Reads lead + last 20 activities
 * + qualification scorecard + MSP profile, returns next-action + why
 * + talk-track. Caches result as ResearchArtifact (no new enum value
 * needed — we reuse the existing types since this is sales-coach output;
 * if we want a dedicated SALES_COACH type, that's a follow-up).
 *
 * Anyone who can see the lead can request coaching.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id: leadId } = await params;

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
        currentMspSatisfaction: true,
        researchSummary: true,
        servicesScore: true,
        customerScore: true,
        dealQualityScore: true,
        expectedCloseDate: true,
      },
    });
    if (!lead) throw new ApiError(404, "Lead not found");

    const teams = await userTeamIds(user.id);
    if (!leadIsVisible(user.role, user.id, lead.ownerUserId, lead.pipelineStage, lead.teamId, teams)) {
      throw new ApiError(403, "Forbidden");
    }

    if (!isAnthropicConfigured()) throw new AnthropicNotConfiguredError();

    const [activities, scorecard] = await Promise.all([
      prisma.activity.findMany({
        where: { leadId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { type: true, subject: true, body: true, outcome: true, createdAt: true },
      }),
      prisma.qualificationScorecard.findUnique({
        where: { leadId },
        select: {
          industryFit: true,
          sizeFit: true,
          geography: true,
          growthPosture: true,
          authority: true,
          budget: true,
          timeline: true,
          complianceDriver: true,
          total: true,
          verdict: true,
          notes: true,
        },
      }),
    ]);

    const result = await coachSale(
      {
        lead: {
          businessName: lead.businessName,
          industry: lead.industry,
          seatCount: lead.seatCount,
          addressCity: lead.addressCity,
          addressState: lead.addressState,
          complianceDrivers: lead.complianceDrivers,
          currentMspName: lead.currentMspName,
          currentMspSatisfaction: lead.currentMspSatisfaction,
          researchSummary: lead.researchSummary,
          pipelineStage: lead.pipelineStage,
          servicesScore: lead.servicesScore,
          customerScore: lead.customerScore,
          dealQualityScore: lead.dealQualityScore,
          expectedCloseDate: lead.expectedCloseDate ? lead.expectedCloseDate.toISOString().slice(0, 10) : null,
        },
        activities: activities.map((a) => ({
          type: String(a.type),
          subject: a.subject,
          body: a.body,
          outcome: a.outcome ? String(a.outcome) : null,
          createdAt: a.createdAt,
        })),
        scorecard: scorecard as Record<string, unknown> | null,
      },
      { leadId, userId: user.id },
    );

    await prisma.researchArtifact.create({
      data: {
        leadId,
        type: ResearchArtifactType.CLAUDE_SUMMARY,
        sourceUrl: null,
        payload: {
          kind: "SALES_COACH",
          nextAction: result.nextAction,
          why: result.why,
          talkTrack: result.talkTrack,
          riskFlags: result.riskFlags,
          confidence: result.confidence,
          generatedAt: new Date().toISOString(),
        } as never,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: leadId,
      action: "UPDATE",
      after: { salesCoachGenerated: true, confidence: result.confidence },
      ...getAuditContext(req),
    });

    return NextResponse.json({
      nextAction: result.nextAction,
      why: result.why,
      talkTrack: result.talkTrack,
      riskFlags: result.riskFlags,
      confidence: result.confidence,
    });
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

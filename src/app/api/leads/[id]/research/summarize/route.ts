import { NextResponse } from "next/server";
import { ResearchArtifactType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { summarizeResearch } from "@/lib/ai/research-summary";
import { AnthropicNotConfiguredError, isAnthropicConfigured } from "@/lib/ai/anthropic";
import { AiBudgetExceededError } from "@/lib/ai/budget";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { researchArtifacts: { orderBy: { createdAt: "desc" }, take: 8 } },
    });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (lead.ownerUserId !== user.id && !can(user.role, "lead:edit:any")) {
      throw new ApiError(403, "Forbidden");
    }
    if (!isAnthropicConfigured()) {
      throw new ApiError(400, "Gateway AI is not configured. Ask your administrator to set the API key.");
    }

    const result = await summarizeResearch({
      // v2.20 — second arg below is the budget context (records AiUsageLog).
      lead: {
        businessName: lead.businessName,
        industry: lead.industry,
        seatCount: lead.seatCount,
        siteCount: lead.siteCount,
        addressCity: lead.addressCity,
        addressState: lead.addressState,
        websiteUrl: lead.websiteUrl,
        linkedinCompanyUrl: lead.linkedinCompanyUrl,
        googleBusinessUrl: lead.googleBusinessUrl,
        primaryContactName: lead.primaryContactName,
        primaryContactTitle: lead.primaryContactTitle,
        executiveSponsorName: lead.executiveSponsorName,
        currentMspName: lead.currentMspName,
        currentMspSatisfaction: lead.currentMspSatisfaction,
        complianceDrivers: lead.complianceDrivers,
        researchSummary: lead.researchSummary,
        // v3.3.11 — multi-service intake passes through
        interestedServices: lead.interestedServices,
        currentPhoneSystem: lead.currentPhoneSystem,
        currentPhonePainPoint: lead.currentPhonePainPoint,
        currentAccessControl: lead.currentAccessControl,
        currentAccessDoorCount: lead.currentAccessDoorCount,
        currentVideoSurveillance: lead.currentVideoSurveillance,
        currentVideoCameraCount: lead.currentVideoCameraCount,
        cablingStatus: lead.cablingStatus,
        expansionPlans: lead.expansionPlans,
        aiAdvisoryInterest: lead.aiAdvisoryInterest,
      },
      artifacts: lead.researchArtifacts.map((a) => ({
        type: a.type,
        sourceUrl: a.sourceUrl,
        payload: a.payload,
      })),
    }, { leadId: lead.id, userId: user.id });

    await prisma.$transaction([
      prisma.researchArtifact.create({
        data: {
          leadId: lead.id,
          type: ResearchArtifactType.CLAUDE_SUMMARY,
          payload: result as never,
          sourceUrl: null,
        },
      }),
      prisma.lead.update({
        where: { id: lead.id },
        data: {
          researchSummary: result.summary,
          researchCompletedAt: new Date(),
          // v3.3.10 — persist the three Research-tab cards on the lead.
          researchFitSignals: result.fitSignals ?? [],
          researchSuggestedQuestions: result.suggestedQuestions ?? [],
          researchRisks: result.risks ?? [],
        },
      }),
    ]);

    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: lead.id,
      action: "UPDATE",
      after: { researchSummaryGenerated: true, summary: result.summary.slice(0, 200) },
      ...getAuditContext(req),
    });

    return NextResponse.json({ summary: result.summary, suggestedQuestions: result.suggestedQuestions, risks: result.risks, fitSignals: result.fitSignals });
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

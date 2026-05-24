import { NextResponse } from "next/server";
import { ResearchArtifactType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can, leadIsVisible } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { discoveryPrep } from "@/lib/ai/discovery-prep";
import { AnthropicNotConfiguredError, isAnthropicConfigured } from "@/lib/ai/anthropic";
import { AiBudgetExceededError } from "@/lib/ai/budget";

/**
 * v2.20 — POST /api/leads/[id]/discovery-call-prep
 *
 * Generates a printable prep brief the salesperson takes into the
 * scheduled Discovery Call: opening line, attendees, 5-8 questions,
 * risks to listen for, success criteria. Result is cached as a
 * ResearchArtifact of type DISCOVERY_PREP_BRIEF.
 *
 * RBAC: lead owner OR lead:edit:any. Anyone who can SEE the lead
 * can request a prep brief.
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
        businessName: true,
        industry: true,
        seatCount: true,
        siteCount: true,
        addressCity: true,
        addressState: true,
        primaryContactName: true,
        primaryContactTitle: true,
        primaryContactEmail: true,
        executiveSponsorName: true,
        executiveSponsorTitle: true,
        complianceDrivers: true,
        currentMspName: true,
        currentMspSatisfaction: true,
        researchSummary: true,
      },
    });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (!leadIsVisible(user.role, user.id, lead.ownerUserId, lead.pipelineStage)) {
      throw new ApiError(403, "Forbidden");
    }
    if (lead.ownerUserId !== user.id && !can(user.role, "lead:edit:any")) {
      throw new ApiError(403, "Forbidden — only the lead owner or a manager can request prep.");
    }

    if (!isAnthropicConfigured()) throw new AnthropicNotConfiguredError();

    const [recentActivities, recentObjections] = await Promise.all([
      prisma.activity.findMany({
        where: { leadId },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { type: true, subject: true, body: true, createdAt: true },
      }),
      prisma.objectionLog.findMany({
        where: { leadId },
        orderBy: { raisedAt: "desc" },
        take: 5,
        select: { category: true, text: true },
      }),
    ]);

    const result = await discoveryPrep(
      {
        lead: {
          businessName: lead.businessName,
          industry: lead.industry,
          seatCount: lead.seatCount,
          siteCount: lead.siteCount,
          addressCity: lead.addressCity,
          addressState: lead.addressState,
          primaryContactName: lead.primaryContactName,
          primaryContactTitle: lead.primaryContactTitle,
          primaryContactEmail: lead.primaryContactEmail,
          executiveSponsorName: lead.executiveSponsorName,
          executiveSponsorTitle: lead.executiveSponsorTitle,
          complianceDrivers: lead.complianceDrivers,
          currentMspName: lead.currentMspName,
          currentMspSatisfaction: lead.currentMspSatisfaction,
          researchSummary: lead.researchSummary,
        },
        recentActivities: recentActivities.map((a) => ({
          type: String(a.type),
          summary: a.subject + (a.body ? ` — ${a.body.slice(0, 200)}` : ""),
          occurredAt: a.createdAt,
        })),
        recentObjections,
      },
      { leadId, userId: user.id },
    );

    await prisma.researchArtifact.create({
      data: {
        leadId,
        type: ResearchArtifactType.DISCOVERY_PREP_BRIEF,
        sourceUrl: null,
        payload: {
          openingLine: result.openingLine,
          attendees: result.attendees,
          questions: result.questions,
          risks: result.risks,
          successCriteria: result.successCriteria,
          generatedAt: new Date().toISOString(),
        } as never,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: leadId,
      action: "UPDATE",
      after: { discoveryPrepGenerated: true, questionCount: result.questions.length },
      ...getAuditContext(req),
    });

    return NextResponse.json({
      openingLine: result.openingLine,
      attendees: result.attendees,
      questions: result.questions,
      risks: result.risks,
      successCriteria: result.successCriteria,
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

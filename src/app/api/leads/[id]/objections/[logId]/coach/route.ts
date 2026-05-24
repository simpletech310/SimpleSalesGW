import { NextResponse } from "next/server";
import { ResearchArtifactType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can, leadIsVisible } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { coachObjection } from "@/lib/ai/objection-coach";
import { AnthropicNotConfiguredError, isAnthropicConfigured } from "@/lib/ai/anthropic";
import { AiBudgetExceededError } from "@/lib/ai/budget";

/**
 * v2.20 — POST /api/leads/[id]/objections/[logId]/coach
 *
 * Generates 2-3 tailored rebuttals for the given ObjectionLog row.
 * Library matches (top-5 ObjectionTemplate rows by category + industry)
 * feed the prompt for voice consistency. Result is cached as a
 * ResearchArtifact of type OBJECTION_REBUTTAL so the UI can re-render
 * it without re-spending Claude tokens.
 *
 * RBAC: lead owner OR lead:edit:any. Anyone who can SEE the lead can
 * coach its objections.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; logId: string }> },
) {
  try {
    const user = await requireSessionUser();
    const { id: leadId, logId } = await params;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        ownerUserId: true,
        pipelineStage: true,
        businessName: true,
        industry: true,
        seatCount: true,
        addressCity: true,
        addressState: true,
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
      throw new ApiError(403, "Forbidden — only the lead owner or a manager can request coaching.");
    }

    const log = await prisma.objectionLog.findUnique({
      where: { id: logId },
      select: { id: true, leadId: true, category: true, text: true },
    });
    if (!log || log.leadId !== leadId) throw new ApiError(404, "Objection log not found");

    if (!isAnthropicConfigured()) throw new AnthropicNotConfiguredError();

    // Pull top-5 library matches: same category + (same industry OR null).
    const libraryMatches = await prisma.objectionTemplate.findMany({
      where: {
        active: true,
        category: log.category,
        OR: [{ industry: lead.industry }, { industry: null }],
      },
      orderBy: [{ industry: "asc" }, { updatedAt: "desc" }],
      take: 5,
      select: { category: true, industry: true, trigger: true, rebuttal: true },
    });

    const result = await coachObjection(
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
        },
        objection: { category: log.category, text: log.text },
        libraryMatches,
      },
      { leadId, userId: user.id },
    );

    // Cache for re-render
    await prisma.researchArtifact.create({
      data: {
        leadId,
        type: ResearchArtifactType.OBJECTION_REBUTTAL,
        sourceUrl: null,
        payload: {
          objectionLogId: logId,
          rebuttals: result.rebuttals,
          ifEscalated: result.ifEscalated,
          generatedAt: new Date().toISOString(),
        } as never,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "ObjectionLog",
      entityId: logId,
      action: "UPDATE",
      after: { aiCoached: true, rebuttalCount: result.rebuttals.length },
      ...getAuditContext(req),
    });

    return NextResponse.json({
      rebuttals: result.rebuttals,
      ifEscalated: result.ifEscalated,
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

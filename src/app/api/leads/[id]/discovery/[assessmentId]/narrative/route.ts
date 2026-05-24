import { NextResponse } from "next/server";
import { DiscoveryStatus, ResearchArtifactType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can, leadIsVisible } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { presaleNarrative } from "@/lib/ai/presale-narrative";
import { AnthropicNotConfiguredError, isAnthropicConfigured } from "@/lib/ai/anthropic";
import { AiBudgetExceededError } from "@/lib/ai/budget";

type ScorecardShape = {
  kind?: string;
  summary?: string;
  findings?: string[];
  risks?: Array<{ severity?: string; description?: string }>;
  recommendedActions?: string[];
  recommendedLineItems?: Array<{
    kind?: string;
    label?: string;
    qty?: number;
    perUnitMrr?: number;
    perUnitOneTime?: number;
    notes?: string;
  }>;
  coveragePct?: number;
};

/**
 * v2.20 — POST /api/leads/[id]/discovery/[assessmentId]/narrative
 *
 * Generates a customer-facing proposal narrative + bullet lists for a
 * completed DiscoveryAssessment. Result cached on a ResearchArtifact
 * of type PRESALE_NARRATIVE.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; assessmentId: string }> },
) {
  try {
    const user = await requireSessionUser();
    const { id: leadId, assessmentId } = await params;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        ownerUserId: true,
        pipelineStage: true,
        businessName: true,
        industry: true,
        primaryContactName: true,
      },
    });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (!leadIsVisible(user.role, user.id, lead.ownerUserId, lead.pipelineStage)) {
      throw new ApiError(403, "Forbidden");
    }
    if (lead.ownerUserId !== user.id && !can(user.role, "lead:edit:any")) {
      throw new ApiError(403, "Forbidden — only the lead owner or a manager can generate a narrative.");
    }

    const assessment = await prisma.discoveryAssessment.findUnique({
      where: { id: assessmentId },
      select: { id: true, leadId: true, kind: true, status: true, scorecard: true },
    });
    if (!assessment || assessment.leadId !== leadId) {
      throw new ApiError(404, "Assessment not found");
    }
    if (assessment.status !== DiscoveryStatus.COMPLETED) {
      throw new ApiError(409, "Assessment must be completed before generating a narrative.");
    }
    if (!assessment.scorecard) {
      throw new ApiError(409, "Assessment has no scorecard.");
    }

    if (!isAnthropicConfigured()) throw new AnthropicNotConfiguredError();

    const sc = assessment.scorecard as ScorecardShape;
    const result = await presaleNarrative(
      {
        lead: {
          businessName: lead.businessName,
          industry: lead.industry,
          primaryContactName: lead.primaryContactName,
        },
        assessment: {
          kind: sc.kind ?? String(assessment.kind),
          summary: sc.summary ?? "",
          findings: Array.isArray(sc.findings) ? sc.findings : [],
          risks: Array.isArray(sc.risks)
            ? sc.risks.map((r) => ({
                severity: String(r.severity ?? "low"),
                description: String(r.description ?? ""),
              }))
            : [],
          recommendedActions: Array.isArray(sc.recommendedActions) ? sc.recommendedActions : [],
          recommendedLineItems: Array.isArray(sc.recommendedLineItems)
            ? sc.recommendedLineItems.map((li) => ({
                kind: String(li.kind ?? "OTHER"),
                label: String(li.label ?? ""),
                qty: Number(li.qty ?? 0),
                perUnitMrr: Number(li.perUnitMrr ?? 0),
                perUnitOneTime: Number(li.perUnitOneTime ?? 0),
                notes: li.notes ? String(li.notes) : undefined,
              }))
            : [],
          coveragePct: typeof sc.coveragePct === "number" ? sc.coveragePct : undefined,
        },
      },
      { leadId, userId: user.id },
    );

    await prisma.researchArtifact.create({
      data: {
        leadId,
        type: ResearchArtifactType.PRESALE_NARRATIVE,
        sourceUrl: null,
        payload: {
          assessmentId,
          narrative: result.narrative,
          included: result.included,
          notIncluded: result.notIncluded,
          nextStep: result.nextStep,
          generatedAt: new Date().toISOString(),
        } as never,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "DiscoveryAssessment",
      entityId: assessmentId,
      action: "UPDATE",
      after: { narrativeGenerated: true },
      ...getAuditContext(req),
    });

    return NextResponse.json({
      narrative: result.narrative,
      included: result.included,
      notIncluded: result.notIncluded,
      nextStep: result.nextStep,
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

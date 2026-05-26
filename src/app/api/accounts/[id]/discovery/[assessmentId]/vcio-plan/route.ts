import { NextResponse } from "next/server";
import { DiscoveryStatus, ResearchArtifactType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { generateVcioPlan } from "@/lib/ai/vcio-recommendations";
import { AnthropicNotConfiguredError, isAnthropicConfigured } from "@/lib/ai/anthropic";
import { AiBudgetExceededError } from "@/lib/ai/budget";
import { scoreDiscovery } from "@/lib/discovery/scoring";

/**
 * v2.23 — POST /api/accounts/[id]/discovery/[assessmentId]/vcio-plan
 *
 * Runs the AI vCIO recommendation feature against the completed
 * assessment + caches the result on DiscoveryAssessment.aiPlanSnapshot
 * + a ResearchArtifact of type VCIO_RECOMMENDATION.
 *
 * RBAC: discovery:edit (VCIO + SUPERADMIN). Customer-side context.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; assessmentId: string }> },
) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "discovery:edit")) throw new ApiError(403, "Forbidden");
    const { id: customerId, assessmentId } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        leadId: true,
        lead: {
          select: {
            businessName: true,
            industry: true,
            seatCount: true,
            addressCity: true,
            addressState: true,
            complianceDrivers: true,
            currentMspName: true,
          },
        },
      },
    });
    if (!customer) throw new ApiError(404, "Customer not found");

    const assessment = await prisma.discoveryAssessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        customerId: true,
        kind: true,
        status: true,
        answers: true,
        scorecard: true,
      },
    });
    if (!assessment || assessment.customerId !== customerId) {
      throw new ApiError(404, "Assessment not found");
    }
    if (assessment.status !== DiscoveryStatus.COMPLETED) {
      throw new ApiError(409, "Assessment must be completed before generating a plan.");
    }

    if (!isAnthropicConfigured()) throw new AnthropicNotConfiguredError();

    // Re-score on the fly when the stored scorecard pre-dates the v3.3.2
    // section digest, so the prompt always carries the richer structure.
    const scorecard = (() => {
      const stored = assessment.scorecard as Record<string, unknown> | null;
      const answers = (assessment.answers ?? {}) as Record<string, unknown>;
      const hasSections = stored && Array.isArray((stored as { sections?: unknown }).sections);
      if (stored && hasSections) return stored;
      try {
        return scoreDiscovery(assessment.kind, answers) as unknown as Record<string, unknown>;
      } catch {
        return stored;
      }
    })();

    const plan = await generateVcioPlan(
      {
        context: {
          businessName: customer.lead.businessName,
          industry: String(customer.lead.industry),
          seatCount: customer.lead.seatCount,
          addressCity: customer.lead.addressCity,
          addressState: customer.lead.addressState,
          complianceDrivers: customer.lead.complianceDrivers.map(String),
          currentMspName: customer.lead.currentMspName,
        },
        assessment: {
          kind: String(assessment.kind),
          scorecard,
          answers: (assessment.answers ?? {}) as Record<string, unknown>,
        },
      },
      // Customer-side calls budget against the underlying leadId so per-lead caps apply consistently.
      { leadId: customer.leadId, userId: user.id },
    );

    const snapshot = {
      summary: plan.summary,
      recommendedTasks: plan.recommendedTasks,
      recommendedServices: plan.recommendedServices,
      risks: plan.risks,
      customerNextStep: plan.customerNextStep,
      // v3.3.6 — confidence + what's missing + how to strengthen
      confidence: plan.confidence,
      limitations: plan.limitations,
      strengthen: plan.strengthen,
      parseError: plan.parseError,
      coveragePct:
        scorecard && typeof (scorecard as { coveragePct?: unknown }).coveragePct === "number"
          ? (scorecard as { coveragePct: number }).coveragePct
          : null,
      generatedAt: new Date().toISOString(),
      generatedByUserId: user.id,
    };

    await prisma.discoveryAssessment.update({
      where: { id: assessmentId },
      data: {
        aiPlanSnapshot: snapshot as never,
        aiPlanGeneratedAt: new Date(),
      },
    });

    // Cache as ResearchArtifact too (mirrors v2.20 pattern).
    await prisma.researchArtifact.create({
      data: {
        leadId: customer.leadId,
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

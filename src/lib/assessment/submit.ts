/**
 * Reusable assessment-submission pipeline.
 * Used by both the authenticated submit route and the public respondent submit route.
 *
 * Side effects in a single Prisma transaction:
 *   - mark assessment COMPLETED
 *   - update Lead scoring + suggested bundle + industry + compliance drivers
 *   - replace ServiceMatch rows
 *   - create ASSESSMENT_COMPLETED Activity
 */

import { ActivityType, AssessmentStatus, ServiceLine } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit, type AuditContext } from "@/lib/audit";
import { computeScores, type AnswerMap, type ScoringResult } from "@/lib/scoring/engine";
import { complianceDriversFromAnswer, industryFromAnswer } from "@/lib/assessment/questions";

export type SubmitContext = AuditContext & {
  /** User id that performed the submit (Lin for IN_PERSON, may be respondent-as-system for SELF_SERVICE) */
  actorUserId: string | null;
};

export async function submitAssessment(
  assessmentId: string,
  ctx: SubmitContext,
): Promise<{ scoring: ScoringResult; leadId: string }> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { answers: true, lead: true },
  });
  if (!assessment) throw new Error("Assessment not found");
  if (assessment.status === AssessmentStatus.COMPLETED) {
    // idempotent: already scored — just return the lead's current scores
    return {
      scoring: {
        servicesScore: assessment.lead.servicesScore,
        customerScore: assessment.lead.customerScore,
        dealQualityScore: assessment.lead.dealQualityScore,
        nonStrategicFlag: assessment.lead.nonStrategicFlag,
        serviceMatches: [],
        suggestedBundle: assessment.lead.suggestedBundle ?? null,
        bucket: bucketFor(assessment.lead.dealQualityScore),
        customerBreakdown: {
          industry: 0, size: 0, geography: 0, growth: 0,
          authority: 0, budget: 0, timeline: 0, compliance: 0,
        },
      },
      leadId: assessment.leadId,
    };
  }

  const answers: AnswerMap = {};
  for (const a of assessment.answers) answers[a.questionId] = a.answerValue;

  const scoring = computeScores(answers, {
    hasExecutiveSponsor: !!assessment.lead.executiveSponsorName,
    geographyReachable: assessment.lead.addressState === "CA" || !assessment.lead.addressState,
  });

  const beforeScores = {
    servicesScore: assessment.lead.servicesScore,
    customerScore: assessment.lead.customerScore,
    dealQualityScore: assessment.lead.dealQualityScore,
    nonStrategicFlag: assessment.lead.nonStrategicFlag,
  };

  await prisma.$transaction([
    prisma.assessment.update({
      where: { id: assessmentId },
      data: { status: AssessmentStatus.COMPLETED, completedAt: new Date() },
    }),
    prisma.lead.update({
      where: { id: assessment.leadId },
      data: {
        servicesScore: scoring.servicesScore,
        customerScore: scoring.customerScore,
        dealQualityScore: scoring.dealQualityScore,
        nonStrategicFlag: scoring.nonStrategicFlag,
        suggestedBundle: scoring.suggestedBundle ?? null,
        industry: industryFromAnswer(typeof answers["Q01"] === "string" ? answers["Q01"] : undefined),
        complianceDrivers: complianceDriversFromAnswer(
          Array.isArray(answers["Q13"]) ? (answers["Q13"] as string[]) : undefined,
        ),
      },
    }),
    prisma.serviceMatch.deleteMany({ where: { leadId: assessment.leadId } }),
    ...scoring.serviceMatches.map((m) =>
      prisma.serviceMatch.create({
        data: {
          leadId: assessment.leadId,
          serviceLine: m.serviceLine as ServiceLine,
          fitScore: m.fitScore,
          reasoning: m.reasoning,
          recommended: m.recommended,
        },
      }),
    ),
    prisma.activity.create({
      data: {
        leadId: assessment.leadId,
        actorUserId: ctx.actorUserId ?? assessment.createdByUserId,
        type: ActivityType.ASSESSMENT_COMPLETED,
        subject: "Assessment scored",
        body: `Services ${scoring.servicesScore} · Customer ${scoring.customerScore} · Deal Quality ${scoring.dealQualityScore}`,
      },
    }),
  ]);

  await writeAudit({
    actorUserId: ctx.actorUserId,
    entityType: "Lead",
    entityId: assessment.leadId,
    action: "UPDATE",
    before: beforeScores,
    after: {
      servicesScore: scoring.servicesScore,
      customerScore: scoring.customerScore,
      dealQualityScore: scoring.dealQualityScore,
      nonStrategicFlag: scoring.nonStrategicFlag,
    },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return { scoring, leadId: assessment.leadId };
}

function bucketFor(score: number): ScoringResult["bucket"] {
  if (score >= 85) return "lighthouse";
  if (score >= 70) return "strong_fit";
  if (score >= 50) return "marginal";
  if (score >= 30) return "refer_or_wait";
  return "polite_decline";
}

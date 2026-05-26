/**
 * v3.3 AI #3 — vCIO go/no-go pre-fill for a completed pre-sale assessment.
 *
 * Reads the assessment answers + lead context and suggests APPROVED /
 * CHANGES_REQUESTED / REJECTED with a 2-sentence rationale. vCIO
 * confirms or overrides — the AI never auto-records a verdict.
 */

import { z } from "zod";
import { AiFeatureKind } from "@prisma/client";
import { withBudgetedJson, type BudgetedJsonResult } from "./with-budget";

const TASK = `## Your job
You are the vCIO's go/no-go assistant. Read the completed pre-sale
assessment + lead context. Suggest one of:
  - APPROVED — clear go, no major risk
  - CHANGES_REQUESTED — workable but needs scope changes before proposal
  - REJECTED — fundamental misfit, recommend politely declining

Output strictly as JSON:
{
  "suggestedVerdict": "APPROVED" | "CHANGES_REQUESTED" | "REJECTED",
  "rationale": "1-2 sentences explaining the suggestion",
  "redFlags": ["specific concern", ...]
}`;

const VerdictSchema = z.object({
  suggestedVerdict: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
  rationale: z.string(),
  redFlags: z.array(z.string()).default([]),
});

export type VerdictSuggestionOutput = z.infer<typeof VerdictSchema>;

export async function suggestAssessmentVerdict(
  input: {
    lead: { businessName: string; industry: string; seatCount: number | null; complianceDrivers: string[] };
    assessment: { kind: string; answers: Record<string, unknown>; scorecard?: Record<string, unknown> | null };
  },
  budget?: { leadId: string; userId?: string },
): Promise<BudgetedJsonResult<VerdictSuggestionOutput>> {
  const user = `LEAD: ${input.lead.businessName} (${input.lead.industry}, ${input.lead.seatCount ?? "?"} seats)
Compliance: ${input.lead.complianceDrivers.join(", ") || "none"}

ASSESSMENT KIND: ${input.assessment.kind}

ANSWERS
${JSON.stringify(input.assessment.answers, null, 2)}

${input.assessment.scorecard ? `SCORECARD\n${JSON.stringify(input.assessment.scorecard, null, 2)}` : ""}`;

  return withBudgetedJson({
    systemTask: TASK,
    user,
    schema: VerdictSchema,
    feature: AiFeatureKind.ASSESSMENT_VERDICT_SUGGEST,
    budget,
    maxTokens: 600,
  });
}

/**
 * v3.3 AI #2 — SOW scope QC for vCIO review.
 *
 * Diffs the SOW scope against the completed discovery. Flags mismatches
 * (e.g. "SOW says 50 seats, discovery captured 75") so the vCIO catches
 * them before approving.
 */

import { z } from "zod";
import { AiFeatureKind } from "@prisma/client";
import { withBudgetedJson, type BudgetedJsonResult } from "./with-budget";

const TASK = `## Your job
You are the vCIO's scope-validation assistant. Diff the SOW SCOPE +
DELIVERABLES against the DISCOVERY findings and identify any mismatch
that should be resolved before sign-off.

Output strictly as JSON:
{
  "verdict": "APPROVED" | "CHANGES_REQUESTED" | "REJECTED",
  "mismatches": [
    { "severity": "HIGH" | "MEDIUM" | "LOW", "detail": "..." }
  ],
  "rationale": "1-2 sentences explaining the verdict"
}

If the SOW is consistent with discovery, return verdict=APPROVED with an
empty mismatches array. Be specific in mismatches — quote numbers and
phrases from both sides.`;

const ScopeQcSchema = z.object({
  verdict: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
  mismatches: z.array(z.object({
    severity: z.enum(["HIGH", "MEDIUM", "LOW"]),
    detail: z.string(),
  })).default([]),
  rationale: z.string(),
});

export type ScopeQcOutput = z.infer<typeof ScopeQcSchema>;

export async function scopeQcSow(
  input: {
    proposal: { scopeMarkdown: string; deliverablesMarkdown: string };
    discovery: Array<{ kind: string; summary: string }>;
  },
  budget?: { leadId: string; userId?: string },
): Promise<BudgetedJsonResult<ScopeQcOutput>> {
  const user = `SOW SCOPE
${input.proposal.scopeMarkdown}

SOW DELIVERABLES
${input.proposal.deliverablesMarkdown}

DISCOVERY FINDINGS
${input.discovery.length === 0 ? "(no discovery captured)" : input.discovery.map((d) => `- ${d.kind}: ${d.summary}`).join("\n")}`;

  return withBudgetedJson({
    systemTask: TASK,
    user,
    schema: ScopeQcSchema,
    feature: AiFeatureKind.SOW_SCOPE_QC,
    budget,
    maxTokens: 800,
  });
}

/**
 * v3.3 AI #4 — Day-30 quick-win suggestion for handoff.
 *
 * Reads discovery + bundle + stated pain and proposes the fastest
 * visible win the Ops team can ship in the first 30 days.
 */

import { z } from "zod";
import { AiFeatureKind } from "@prisma/client";
import { withBudgetedJson, type BudgetedJsonResult } from "./with-budget";

const TASK = `## Your job
You are helping the salesperson write the Day-30 Quick Win for the
sales-to-ops handoff. This is what we promise the customer will see
delivered in the first 30 days — concrete, visible, measurable.

Output strictly as JSON:
{
  "quickWin": "single sentence, present-tense action with a measurable deliverable",
  "rationale": "1 sentence why this beats other candidates"
}

Examples of good quick wins:
- "Deploy MFA on all 47 O365 accounts by Day 14, summarize results at the Day-30 check-in."
- "Migrate the 3 file shares to OneDrive with full version history by Day 21."
- "Document and remediate the 12 critical CVEs surfaced in discovery by Day 25."`;

const QuickWinSchema = z.object({
  quickWin: z.string(),
  rationale: z.string(),
});

export type QuickWinOutput = z.infer<typeof QuickWinSchema>;

export async function suggestDay30Win(
  input: {
    lead: { businessName: string; industry: string; seatCount: number | null; complianceDrivers: string[] };
    bundle: string | null;
    statedPain: string | null;
    discoveryHighlights: string[];
  },
  budget?: { leadId: string; userId?: string },
): Promise<BudgetedJsonResult<QuickWinOutput>> {
  const user = `LEAD: ${input.lead.businessName} (${input.lead.industry}, ${input.lead.seatCount ?? "?"} seats)
Bundle: ${input.bundle ?? "n/a"}
Compliance: ${input.lead.complianceDrivers.join(", ") || "none"}

STATED PAIN: ${input.statedPain ?? "(none captured)"}

DISCOVERY HIGHLIGHTS
${input.discoveryHighlights.length === 0 ? "(none)" : input.discoveryHighlights.map((h) => `- ${h}`).join("\n")}`;

  return withBudgetedJson({
    systemTask: TASK,
    user,
    schema: QuickWinSchema,
    feature: AiFeatureKind.HANDOFF_QUICK_WIN,
    budget,
    maxTokens: 400,
  });
}

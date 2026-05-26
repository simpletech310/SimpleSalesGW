/**
 * v3.3 AI #5 — Stated-pain recap for the handoff form.
 *
 * Extracts the strongest pain quote from discovery + activities and
 * paraphrases it into a 1-2 sentence recap in the customer's own words.
 */

import { z } from "zod";
import { AiFeatureKind } from "@prisma/client";
import { withBudgetedJson, type BudgetedJsonResult } from "./with-budget";

const TASK = `## Your job
You are paraphrasing the customer's stated pain for the sales-to-ops
handoff. Pull the strongest signal from the discovery + activities
and produce a 1-2 sentence recap in the customer's voice — third
person, but using their phrasing.

Output strictly as JSON:
{
  "statedPain": "1-2 sentence recap",
  "sourceQuote": "the verbatim line you pulled from, or empty string if synthesized"
}`;

const PainRecapSchema = z.object({
  statedPain: z.string(),
  sourceQuote: z.string().default(""),
});

export type PainRecapOutput = z.infer<typeof PainRecapSchema>;

export async function recapPain(
  input: {
    lead: { businessName: string; industry: string };
    discoveryHighlights: string[];
    activityQuotes: string[];
  },
  budget?: { leadId: string; userId?: string },
): Promise<BudgetedJsonResult<PainRecapOutput>> {
  const user = `LEAD: ${input.lead.businessName} (${input.lead.industry})

DISCOVERY HIGHLIGHTS
${input.discoveryHighlights.length === 0 ? "(none)" : input.discoveryHighlights.map((h) => `- ${h}`).join("\n")}

ACTIVITY QUOTES
${input.activityQuotes.length === 0 ? "(none)" : input.activityQuotes.map((q) => `- "${q}"`).join("\n")}`;

  return withBudgetedJson({
    systemTask: TASK,
    user,
    schema: PainRecapSchema,
    feature: AiFeatureKind.HANDOFF_PAIN_RECAP,
    budget,
    maxTokens: 400,
  });
}

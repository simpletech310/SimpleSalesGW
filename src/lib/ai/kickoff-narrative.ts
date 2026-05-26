/**
 * v3.3 AI #7 — Kickoff relationship-narrative draft.
 *
 * Salesperson uses this 24h before the Day-1 kickoff to draft the
 * relationship narrative they'll deliver. Reads discovery + activity
 * log + handoff and writes a 3-paragraph hand-off-to-vCIO story.
 */

import { z } from "zod";
import { AiFeatureKind } from "@prisma/client";
import { withBudgetedJson, type BudgetedJsonResult } from "./with-budget";

const TASK = `## Your job
You are writing the relationship narrative the salesperson delivers at
the Day-1 kickoff to warm-hand-off the customer relationship to the vCIO.

Three short paragraphs:
  1. Who we met + what we learned about the people (sponsor, decision-maker, day-to-day champion)
  2. The business context that drove the deal (trigger event, stated pain, urgency)
  3. What we committed to in the SOW + Day-30 quick win — keep verbatim wording where it matters

Output strictly as JSON:
{
  "paragraphPeople":     "...",
  "paragraphBusiness":   "...",
  "paragraphCommitment": "...",
  "speakerNotes":        ["short note for the salesperson before they speak", ...]
}

Voice = warm, specific, no MBA-speak. Use names. Avoid superlatives.`;

const KickoffSchema = z.object({
  paragraphPeople: z.string(),
  paragraphBusiness: z.string(),
  paragraphCommitment: z.string(),
  speakerNotes: z.array(z.string()).default([]),
});

export type KickoffNarrativeOutput = z.infer<typeof KickoffSchema>;

export async function draftKickoffNarrative(
  input: {
    customer: { businessName: string; industry: string };
    sourceLead: { triggerEvent: string | null; statedPain: string | null };
    contacts: Array<{ name: string; title: string | null; role: string }>;
    discoveryHighlights: string[];
    commitments: { sowSummary: string; day30QuickWin: string | null };
  },
  budget?: { leadId?: string; userId?: string },
): Promise<BudgetedJsonResult<KickoffNarrativeOutput>> {
  const user = `CUSTOMER: ${input.customer.businessName} (${input.customer.industry})

TRIGGER EVENT: ${input.sourceLead.triggerEvent ?? "none"}
STATED PAIN:   ${input.sourceLead.statedPain ?? "(not captured)"}

CONTACTS
${input.contacts.map((c) => `- ${c.name}${c.title ? `, ${c.title}` : ""} (${c.role})`).join("\n")}

DISCOVERY HIGHLIGHTS
${input.discoveryHighlights.length === 0 ? "(none)" : input.discoveryHighlights.map((h) => `- ${h}`).join("\n")}

COMMITMENTS
SOW summary: ${input.commitments.sowSummary}
Day-30 quick win: ${input.commitments.day30QuickWin ?? "(not set)"}`;

  return withBudgetedJson({
    systemTask: TASK,
    user,
    schema: KickoffSchema,
    feature: AiFeatureKind.KICKOFF_NARRATIVE,
    budget,
    maxTokens: 1200,
  });
}

/**
 * v3.3 AI #8 — Deal debrief draft.
 *
 * Mandatory at CLOSED_WON / CLOSED_LOST. Reads the lead's full history
 * (activities, objections, pricing approvals, discovery, outcome) and
 * proposes a populated debrief. Rep edits + submits. The AI suggestion
 * is stored verbatim for later "did the rep agree?" analytics.
 */

import { z } from "zod";
import { AiFeatureKind } from "@prisma/client";
import { withBudgetedJson, type BudgetedJsonResult } from "./with-budget";

const PRIMARY_REASONS = ["PRICE", "SCOPE", "TIMING", "TRUST", "RELATIONSHIP", "INCUMBENT", "OTHER"] as const;

const TASK = `## Your job
The salesperson just closed this deal (WON or LOST). Read the full
activity + objection + pricing history and propose a structured debrief.

Output strictly as JSON:
{
  "primaryReason": "PRICE" | "SCOPE" | "TIMING" | "TRUST" | "RELATIONSHIP" | "INCUMBENT" | "OTHER",
  "whatWorked":       "(CLOSED_WON) what specifically drove the yes — 1-3 sentences. Empty string if LOST.",
  "objectionResolved": "(CLOSED_WON) which top objection got resolved + how. Empty string if LOST.",
  "templateThatWon":   "(CLOSED_WON) name of the outreach template that landed the meeting if inferable, else empty",
  "whatBroke":        "(CLOSED_LOST) what specifically killed the deal — 1-3 sentences. Empty string if WON.",
  "playbookUpdate":   "What to tweak in objections / outreach / scoring based on this deal. Always populate."
}

Be specific. Cite activities, objection names, pricing-approval rejections
by quoting from the data. Avoid generalities like "good rapport".`;

const DebriefSchema = z.object({
  primaryReason: z.enum(PRIMARY_REASONS),
  whatWorked: z.string().default(""),
  objectionResolved: z.string().default(""),
  templateThatWon: z.string().default(""),
  whatBroke: z.string().default(""),
  playbookUpdate: z.string(),
});

export type DebriefDraftOutput = z.infer<typeof DebriefSchema>;

export async function draftDebrief(
  input: {
    lead: { businessName: string; industry: string; pipelineStage: string; closedLostReason: string | null };
    outcome: "CLOSED_WON" | "CLOSED_LOST";
    activities: Array<{ type: string; subject: string; outcome: string | null; createdAt: string }>;
    objections: Array<{ category: string; trigger: string; resolved: boolean }>;
    pricingApprovals: Array<{ tier: string; status: string; discountPct: number; reason: string | null }>;
    discoveryHighlights: string[];
  },
  budget?: { leadId: string; userId?: string },
): Promise<BudgetedJsonResult<DebriefDraftOutput>> {
  const user = `LEAD: ${input.lead.businessName} (${input.lead.industry})
OUTCOME: ${input.outcome}
${input.lead.closedLostReason ? `Closed-lost reason field: ${input.lead.closedLostReason}` : ""}

ACTIVITIES (most recent first)
${input.activities.slice(0, 20).map((a) => `- [${a.createdAt}] ${a.type}: ${a.subject}${a.outcome ? ` → ${a.outcome}` : ""}`).join("\n") || "(none)"}

OBJECTIONS
${input.objections.map((o) => `- ${o.category} (${o.resolved ? "RESOLVED" : "open"}): "${o.trigger}"`).join("\n") || "(none)"}

PRICING APPROVALS
${input.pricingApprovals.map((p) => `- ${p.tier} tier, ${p.discountPct}% off → ${p.status}${p.reason ? ` (${p.reason})` : ""}`).join("\n") || "(none)"}

DISCOVERY HIGHLIGHTS
${input.discoveryHighlights.length === 0 ? "(none)" : input.discoveryHighlights.map((h) => `- ${h}`).join("\n")}`;

  return withBudgetedJson({
    systemTask: TASK,
    user,
    schema: DebriefSchema,
    feature: AiFeatureKind.DEBRIEF_DRAFT,
    budget,
    maxTokens: 1000,
  });
}

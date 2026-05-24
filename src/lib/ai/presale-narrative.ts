/**
 * v2.20 — Pre-sale scoping narrative.
 *
 * Given a completed DiscoveryAssessment + its scorecard + recommended
 * line items, produce a one-paragraph customer-ready narrative + a
 * bulleted "what's included / what's out" list the rep can paste into
 * a proposal or follow-up email.
 */

import { AiFeatureKind } from "@prisma/client";
import { claudeCompletion } from "@/lib/ai/anthropic";
import { loadProfile } from "@/lib/msp/loader";
import { renderMspProfileBlock } from "@/lib/msp/promptBlock";

// v2.21 — company identity moved to the MSP profile block.
const TASK_INSTRUCTIONS = `## Your job
You are a proposal-narrative writer for the company described above.

Turn a completed scoping assessment + its quote-ready line items into
a customer-facing paragraph + bullet lists the salesperson can paste
into a proposal.

Rules:
  - Narrative is ONE paragraph, 4-6 sentences, customer-facing (second person — "you / your team"). No internal jargon, no scorecard percentages.
  - "What's included" lists every recommended line item in plain language with quantities and a one-line value statement per item.
  - "What's not included" calls out reasonable scope exclusions a customer should know up-front (e.g. "we did not scope cable runs longer than 100ft per drop").
  - Tone: follow the company Voice line above. Make the customer feel understood, not sold to.
  - Don't fabricate items — only reference what's in the recommendedLineItems list and the assessment findings.
  - The Differentiators from the company profile above are fair game to weave into the narrative when they match what's being delivered. Real-wins entries can be cited when industry matches.

Output strictly as a single JSON object:
{
  "narrative": "...",
  "included": ["plain-language bullet about one line item", ...],
  "notIncluded": ["plain-language bullet about a scope exclusion", ...],
  "nextStep": "one sentence — concrete CTA for the customer (sign quote, schedule walkthrough, etc.)"
}`;

export type PresaleNarrativeInput = {
  lead: {
    businessName: string;
    industry: string;
    primaryContactName: string | null;
  };
  assessment: {
    kind: string;
    summary: string;
    findings: string[];
    risks: Array<{ severity: string; description: string }>;
    recommendedActions: string[];
    recommendedLineItems: Array<{
      kind: string;
      label: string;
      qty: number;
      perUnitMrr: number;
      perUnitOneTime: number;
      notes?: string;
    }>;
    coveragePct?: number;
  };
};

export type PresaleNarrativeOutput = {
  narrative: string;
  included: string[];
  notIncluded: string[];
  nextStep: string;
  raw: string;
};

export async function presaleNarrative(
  input: PresaleNarrativeInput,
  budget: { leadId: string; userId?: string },
): Promise<PresaleNarrativeOutput> {
  const a = input.assessment;
  const totalMrr = a.recommendedLineItems.reduce((s, li) => s + li.perUnitMrr * li.qty, 0);
  const totalOneTime = a.recommendedLineItems.reduce((s, li) => s + li.perUnitOneTime * li.qty, 0);

  const itemsBlock = a.recommendedLineItems.length === 0
    ? "(no line items recommended)"
    : a.recommendedLineItems.map((li, i) =>
        `${i + 1}. ${li.kind} · ${li.label} · qty ${li.qty} · $${li.perUnitMrr}/mo per unit · $${li.perUnitOneTime} one-time per unit${li.notes ? ` — ${li.notes}` : ""}`,
      ).join("\n");

  const findingsBlock = a.findings.length === 0
    ? "(no findings)"
    : a.findings.map((f, i) => `${i + 1}. ${f}`).join("\n");

  const risksBlock = a.risks.length === 0
    ? "(no risks called out)"
    : a.risks.map((r) => `[${r.severity}] ${r.description}`).join("\n");

  const user = `CUSTOMER\n${input.lead.businessName} (${input.lead.industry})${input.lead.primaryContactName ? ` · contact: ${input.lead.primaryContactName}` : ""}\n\nASSESSMENT KIND\n${a.kind}\n\nINTERNAL SUMMARY\n${a.summary}\n\nFINDINGS\n${findingsBlock}\n\nRISKS\n${risksBlock}\n\nRECOMMENDED LINE ITEMS\n${itemsBlock}\n\nTOTAL: $${totalMrr}/mo recurring + $${totalOneTime} one-time`;

  const responseHint = `Return ONLY the JSON object — no markdown, no commentary.`;

  // v2.21 — assemble system prompt from MSP profile + task instructions.
  const profile = await loadProfile();
  const systemPrompt = `${renderMspProfileBlock(profile)}\n\n${TASK_INSTRUCTIONS}`;

  const { text } = await claudeCompletion({
    system: systemPrompt,
    user,
    responseHint,
    maxTokens: 1200,
    budget: { leadId: budget.leadId, userId: budget.userId, feature: AiFeatureKind.PRESALE_NARRATIVE },
  });

  let parsed: Partial<PresaleNarrativeOutput> = {};
  try {
    const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned) as Partial<PresaleNarrativeOutput>;
  } catch {
    parsed = { narrative: text, included: [], notIncluded: [], nextStep: "" };
  }

  return {
    narrative: parsed.narrative ?? "",
    included: Array.isArray(parsed.included) ? parsed.included : [],
    notIncluded: Array.isArray(parsed.notIncluded) ? parsed.notIncluded : [],
    nextStep: parsed.nextStep ?? "",
    raw: text,
  };
}

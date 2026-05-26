/**
 * v2.20 — Objection rebuttal coach.
 *
 * Given a logged objection on a Lead, Claude reads:
 *   - the objection text + category
 *   - the top library matches (existing ObjectionTemplate rows for the
 *     same category and/or industry)
 *   - lean Lead context (industry, seat count, compliance, current MSP)
 *
 * Returns 2–3 tailored rebuttals, each with a one-line "why this works"
 * rationale. The library serves as in-context examples so the output
 * stays consistent with Gateway voice.
 */

import { AiFeatureKind } from "@prisma/client";
import { claudeCompletion } from "@/lib/ai/anthropic";
import { loadProfile } from "@/lib/msp/loader";
import { renderMspProfileBlock } from "@/lib/msp/promptBlock";

// v2.21 — company identity moved to the MSP profile block (prepended
// at call time). This file keeps only the task-specific instructions.
const TASK_INSTRUCTIONS = `## Your job
You are an MSP sales coach for the company described above.

When a salesperson logs a real customer objection, generate 2–3 short,
tailored rebuttals the rep can paste into a reply or use live on a
call. Each rebuttal should:
  - Open with the objection-acknowledging move (mirror / reframe / explore)
  - Make ONE clear point grounded in the lead's actual context (industry, size, compliance posture, current MSP)
  - Land on a concrete next step or question

Tone: follow the Voice line above. ~2-3 sentences each.

Reference the provided library rebuttals for voice + framing, but DO
NOT just repeat them verbatim — personalize using the lead context.
When you have a relevant Real-wins entry from the company profile
above that matches the lead's industry, weave it into one of the
rebuttals as concrete proof.

Respect the services emphasis rules: don't propose [de-emphasize]
services as the rebuttal's next-step. Push [focus] services when they
genuinely fit.

Output strictly as a single JSON object:
{
  "rebuttals": [
    { "rebuttal": "...", "why": "one-line rationale", "tone": "warm|direct|consultative" },
    ...
  ],
  "ifEscalated": "one-sentence backup the rep can use if the customer pushes back"
}

If lead context is too thin to personalize, say so in "ifEscalated" and keep rebuttals generic-but-on-voice.`;

export type ObjectionCoachInput = {
  lead: {
    businessName: string;
    industry: string;
    seatCount: number | null;
    addressCity: string | null;
    addressState: string | null;
    complianceDrivers: string[];
    currentMspName: string | null;
    currentMspSatisfaction: string;
    researchSummary: string | null;
  };
  objection: {
    category: string;
    text: string;
  };
  libraryMatches: Array<{
    category: string;
    industry: string | null;
    trigger: string;
    rebuttal: string;
  }>;
};

export type ObjectionCoachOutput = {
  rebuttals: Array<{ rebuttal: string; why: string; tone: string }>;
  ifEscalated: string;
  raw: string;
};

export async function coachObjection(
  input: ObjectionCoachInput,
  budget: { leadId: string; userId?: string },
): Promise<ObjectionCoachOutput> {
  const lead = input.lead;
  const ctx = [
    `Business: ${lead.businessName}`,
    `Industry: ${lead.industry}`,
    lead.seatCount ? `Seats: ${lead.seatCount}` : null,
    lead.addressCity || lead.addressState ? `Location: ${[lead.addressCity, lead.addressState].filter(Boolean).join(", ")}` : null,
    lead.complianceDrivers.length > 0 ? `Compliance: ${lead.complianceDrivers.join(", ")}` : null,
    lead.currentMspName ? `Current MSP: ${lead.currentMspName} (${lead.currentMspSatisfaction})` : null,
    lead.researchSummary ? `Research notes: ${lead.researchSummary}` : null,
  ].filter(Boolean).join("\n");

  const libBlock = input.libraryMatches.length === 0
    ? "(no library matches available — use voice from system prompt only)"
    : input.libraryMatches.map((m, i) =>
        `[Library ${i + 1}] (${m.category}${m.industry ? `, ${m.industry}` : ""})\nTRIGGER: ${m.trigger}\nREBUTTAL: ${m.rebuttal}`,
      ).join("\n\n");

  const user = `LEAD CONTEXT\n${ctx}\n\nOBJECTION\nCategory: ${input.objection.category}\nText: "${input.objection.text}"\n\nLIBRARY MATCHES\n${libBlock}`;

  const responseHint = `Return ONLY the JSON object — no markdown, no commentary.`;

  // v2.21 — assemble system prompt from MSP profile + task instructions.
  // v3.3.14 — catalog grounding for rebuttals that propose alternatives.
  const profile = await loadProfile();
  const { loadCatalogBlock } = await import("@/lib/ai/catalog-grounding");
  const catalogBlock = await loadCatalogBlock();
  const systemPrompt = `${renderMspProfileBlock(profile)}\n\n${catalogBlock}\n\n${TASK_INSTRUCTIONS}`;

  const { text } = await claudeCompletion({
    system: systemPrompt,
    user,
    responseHint,
    maxTokens: 900,
    budget: { leadId: budget.leadId, userId: budget.userId, feature: AiFeatureKind.OBJECTION_REBUTTAL },
  });

  let parsed: { rebuttals?: Array<{ rebuttal: string; why: string; tone: string }>; ifEscalated?: string } = {};
  try {
    const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned) as typeof parsed;
  } catch {
    // Fallback: treat the whole thing as one rebuttal
    parsed = { rebuttals: [{ rebuttal: text, why: "(parse fallback)", tone: "warm" }] };
  }

  return {
    rebuttals: Array.isArray(parsed.rebuttals) ? parsed.rebuttals : [],
    ifEscalated: parsed.ifEscalated ?? "",
    raw: text,
  };
}

/**
 * v2.20 — Outreach copy personalizer.
 *
 * Takes an OutreachTemplate (or a raw subject+body draft) plus the
 * Lead context (industry, contact, research summary) and returns a
 * fully-personalized `{ subject, body }` ready for the rep to review
 * and send. Tone is selectable: warm / formal / follow-up.
 */

import { AiFeatureKind } from "@prisma/client";
import { claudeCompletion } from "@/lib/ai/anthropic";
import { loadProfile } from "@/lib/msp/loader";
import { renderMspProfileBlock } from "@/lib/msp/promptBlock";

export type OutreachTone = "warm" | "formal" | "follow_up";

// v2.21 — company identity + brand voice come from the MSP profile
// block at call time. This file keeps only task-specific instructions.
const TASK_INSTRUCTIONS = `## Your job
You are a B2B email-copy editor for the company described above.

Rewrite a template-style outreach email so it sounds like it was
written for THIS lead and THIS contact — specific, brief, and
respectful of the reader's time. Follow the company Voice line above.

Rules:
  - Open with one specific reference from the lead context (industry, location, compliance posture, or research notes). If the context is truly thin, lead with the value proposition for their industry — never invent facts.
  - Body is 3-5 short sentences. No bullet lists unless the source template already used them.
  - End with ONE clear ask (15-minute call, reply with a date, intro to the right person).
  - Subject line is under 60 chars, lower-case if the tone is warm, sentence-case if formal.
  - Keep the rep's signature line as-is.

Service-emphasis rules: surface [focus] services where they fit the
industry. Don't mention [de-emphasize] services unless the source
template already does. Use a Real-wins entry from the company profile
above if one matches the lead's industry — that's the strongest
opener.

Follow the Full-stack consideration rule from the company profile.
Don't default every outreach to "harden your security" — for retail
or multi-location leads lead with access control or video; for fast-
growing leads lead with voice or AI advisory; for new builds lead
with cabling. Match the angle to the lead's actual signals.

Tone modes (overrides the default Voice when set):
  - warm: like a real human, conversational, contractions OK
  - formal: business-appropriate, no contractions, slightly more polished
  - follow_up: short — under 4 sentences total — acknowledging the prior reach-out without being needy

Output strictly as a single JSON object:
{
  "subject": "...",
  "body": "...",
  "notes": "one-line on what you changed and why"
}`;

export type OutreachPersonalizeInput = {
  lead: {
    businessName: string;
    industry: string;
    addressCity: string | null;
    addressState: string | null;
    seatCount: number | null;
    complianceDrivers: string[];
    currentMspName: string | null;
    currentMspSatisfaction: string;
    primaryContactName: string | null;
    primaryContactTitle: string | null;
    researchSummary: string | null;
  };
  template: {
    name: string;
    category: string;
    subject: string;
    body: string;
  };
  senderName: string;
  tone: OutreachTone;
};

export type OutreachPersonalizeOutput = {
  subject: string;
  body: string;
  notes: string;
  raw: string;
};

export async function personalizeOutreach(
  input: OutreachPersonalizeInput,
  budget: { leadId: string; userId?: string },
): Promise<OutreachPersonalizeOutput> {
  const lead = input.lead;
  const ctx = [
    `Business: ${lead.businessName}`,
    `Industry: ${lead.industry}`,
    lead.seatCount ? `Seats: ${lead.seatCount}` : null,
    lead.addressCity || lead.addressState
      ? `Location: ${[lead.addressCity, lead.addressState].filter(Boolean).join(", ")}`
      : null,
    lead.complianceDrivers.length > 0 ? `Compliance drivers: ${lead.complianceDrivers.join(", ")}` : null,
    lead.currentMspName ? `Current MSP: ${lead.currentMspName} (${lead.currentMspSatisfaction})` : null,
    lead.primaryContactName
      ? `Contact: ${lead.primaryContactName}${lead.primaryContactTitle ? `, ${lead.primaryContactTitle}` : ""}`
      : null,
    lead.researchSummary ? `\nResearch summary:\n${lead.researchSummary}` : null,
  ].filter(Boolean).join("\n");

  const user = `LEAD CONTEXT\n${ctx}\n\nSENDER\n${input.senderName}\n\nTONE\n${input.tone}\n\nSOURCE TEMPLATE\nName: ${input.template.name}\nCategory: ${input.template.category}\nSubject: ${input.template.subject}\nBody:\n${input.template.body}`;

  const responseHint = `Return ONLY the JSON object — no markdown, no commentary.`;

  // v2.21 — assemble system prompt from MSP profile + task instructions.
  const profile = await loadProfile();
  const systemPrompt = `${renderMspProfileBlock(profile)}\n\n${TASK_INSTRUCTIONS}`;

  const { text } = await claudeCompletion({
    system: systemPrompt,
    user,
    responseHint,
    maxTokens: 1000,
    budget: { leadId: budget.leadId, userId: budget.userId, feature: AiFeatureKind.OUTREACH_PERSONALIZE },
  });

  let parsed: Partial<OutreachPersonalizeOutput> = {};
  try {
    const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned) as Partial<OutreachPersonalizeOutput>;
  } catch {
    // Fallback: keep source template, dump raw model output into notes
    parsed = {
      subject: input.template.subject,
      body: input.template.body,
      notes: `(parse failure — model returned: ${text.slice(0, 120)}…)`,
    };
  }

  return {
    subject: parsed.subject ?? input.template.subject,
    body: parsed.body ?? input.template.body,
    notes: parsed.notes ?? "",
    raw: text,
  };
}

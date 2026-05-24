/**
 * v2.20 — Discovery call prep brief.
 *
 * Given a Lead + its research summary + recent activity, Claude returns
 * a printable card the salesperson takes into the call:
 *   - 3–5 attendee notes (who to look up + why)
 *   - 5–8 industry-tailored discovery questions
 *   - 3 risks to listen for
 *   - 3 success criteria for the call
 *   - 1 opening line in Gateway voice
 */

import { AiFeatureKind } from "@prisma/client";
import { claudeCompletion } from "@/lib/ai/anthropic";

const SYSTEM_PROMPT = `You are a discovery-call prep coach for Gateway TelNet (Burbank, CA). Gateway sells Managed IT, Cybersecurity, NIST/CMMC compliance, AI Advisory, VoIP, Cabling, Access Control, Video Surveillance, and vCIO Retainer.

Your job: given a Lead + research summary + recent activity history, produce a tight prep brief the rep can scan in 60 seconds before joining the discovery call. Be specific to this lead — never generic.

Tone: warm + direct, no fluff, no MBA-speak.

Output strictly as a single JSON object:
{
  "openingLine": "one sentence the rep can say to open the call — references something concrete from the lead context",
  "attendees": [
    { "name": "person", "role": "title", "why": "what to learn from them" }
  ],
  "questions": [
    { "question": "...", "rationale": "one-line why this matters for THIS lead" }
  ],
  "risks": ["red flag to listen for", ...],
  "successCriteria": ["what makes this call a win", ...]
}

If context is thin, ask qualifying questions in "questions" and call out the gap in "risks". 5-8 questions, 3 risks, 3 success criteria.`;

export type DiscoveryPrepInput = {
  lead: {
    businessName: string;
    industry: string;
    seatCount: number | null;
    siteCount: number;
    addressCity: string | null;
    addressState: string | null;
    primaryContactName: string | null;
    primaryContactTitle: string | null;
    primaryContactEmail: string | null;
    executiveSponsorName: string | null;
    executiveSponsorTitle: string | null;
    complianceDrivers: string[];
    currentMspName: string | null;
    currentMspSatisfaction: string;
    researchSummary: string | null;
  };
  recentActivities: Array<{
    type: string;
    summary: string | null;
    occurredAt: Date;
  }>;
  recentObjections: Array<{
    category: string;
    text: string;
  }>;
};

export type DiscoveryPrepOutput = {
  openingLine: string;
  attendees: Array<{ name: string; role: string; why: string }>;
  questions: Array<{ question: string; rationale: string }>;
  risks: string[];
  successCriteria: string[];
  raw: string;
};

export async function discoveryPrep(
  input: DiscoveryPrepInput,
  budget: { leadId: string; userId?: string },
): Promise<DiscoveryPrepOutput> {
  const lead = input.lead;
  const ctx = [
    `Business: ${lead.businessName}`,
    `Industry: ${lead.industry}`,
    lead.seatCount ? `Seats: ${lead.seatCount}` : null,
    lead.siteCount > 1 ? `Sites: ${lead.siteCount}` : null,
    lead.addressCity || lead.addressState
      ? `Location: ${[lead.addressCity, lead.addressState].filter(Boolean).join(", ")}`
      : null,
    lead.primaryContactName
      ? `Primary contact: ${lead.primaryContactName}${lead.primaryContactTitle ? `, ${lead.primaryContactTitle}` : ""}`
      : null,
    lead.executiveSponsorName
      ? `Exec sponsor: ${lead.executiveSponsorName}${lead.executiveSponsorTitle ? `, ${lead.executiveSponsorTitle}` : ""}`
      : null,
    lead.complianceDrivers.length > 0 ? `Compliance: ${lead.complianceDrivers.join(", ")}` : null,
    lead.currentMspName ? `Current MSP: ${lead.currentMspName} (${lead.currentMspSatisfaction})` : null,
    lead.researchSummary ? `\nResearch summary:\n${lead.researchSummary}` : null,
  ].filter(Boolean).join("\n");

  const activityBlock = input.recentActivities.length === 0
    ? "(no prior activities logged)"
    : input.recentActivities
        .slice(0, 6)
        .map((a) => `- ${a.occurredAt.toISOString().slice(0, 10)} · ${a.type}${a.summary ? `: ${a.summary}` : ""}`)
        .join("\n");

  const objectionBlock = input.recentObjections.length === 0
    ? "(no objections logged yet)"
    : input.recentObjections
        .map((o) => `- [${o.category}] "${o.text}"`)
        .join("\n");

  const user = `LEAD CONTEXT\n${ctx}\n\nRECENT ACTIVITY\n${activityBlock}\n\nPRIOR OBJECTIONS\n${objectionBlock}`;

  const responseHint = `Return ONLY the JSON object — no markdown, no commentary.`;

  const { text } = await claudeCompletion({
    system: SYSTEM_PROMPT,
    user,
    responseHint,
    maxTokens: 1200,
    budget: { leadId: budget.leadId, userId: budget.userId, feature: AiFeatureKind.DISCOVERY_PREP },
  });

  let parsed: Partial<DiscoveryPrepOutput> = {};
  try {
    const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned) as Partial<DiscoveryPrepOutput>;
  } catch {
    // Fallback: dump everything into successCriteria so it's visible
    parsed = {
      openingLine: "",
      attendees: [],
      questions: [],
      risks: [],
      successCriteria: [text],
    };
  }

  return {
    openingLine: parsed.openingLine ?? "",
    attendees: Array.isArray(parsed.attendees) ? parsed.attendees : [],
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    successCriteria: Array.isArray(parsed.successCriteria) ? parsed.successCriteria : [],
    raw: text,
  };
}

/**
 * v2.22 — AI Sales Coach.
 *
 * Reads the lead + last 20 activities + qualification scorecard +
 * MSP profile and returns the next-best-action with rationale + a
 * talk-track the rep can use.
 *
 * Pattern matches v2.20 features (objection coach, discovery prep):
 *   - MSP profile block prepended to system prompt
 *   - Single JSON object output
 *   - Budget-gated via claudeCompletion
 */

import { AiFeatureKind } from "@prisma/client";
import { claudeCompletion } from "@/lib/ai/anthropic";
import { loadProfile } from "@/lib/msp/loader";
import { renderMspProfileBlock } from "@/lib/msp/promptBlock";

const TASK_INSTRUCTIONS = `## Your job
You are an in-the-moment sales coach for the company described above.

A rep is working a specific deal. You have:
  - The Lead's full context (industry, size, location, current MSP, compliance posture)
  - The last 20 Activity events on the deal (calls, meetings, door knocks, gatekeeper rejections, objections raised, etc.)
  - The Qualification scorecard (if scored)
  - The MSP profile above (services emphasis, win stories, voice)

Your job: tell the rep what to do NEXT, why, and give them a 2-3 sentence talk-track they can use on the next interaction.

Rules:
  - Be specific to this deal — never generic.
  - Ground "why" in the actual activity history. Reference recent events by what happened ("they gatekeeper-rejected twice yesterday" not "they've been hard to reach").
  - Respect the services emphasis from the company profile: lean toward [focus] services where they fit, do not propose [de-emphasize] services.
  - Follow the Full-stack consideration rule from the company profile above. Before suggesting a security / NIST angle, check whether the lead has actually signaled security pain. If not, consider voice (VoIP), access control, video surveillance, AI advisory, or vCIO retainer as equally valid angles. The next best action might be "ask about their phone system" or "scope cameras for the new location", not always "send a security checklist".
  - If a Real-win entry from the company profile matches this lead's industry, weave it into the talk-track.
  - Tone: follow the company Voice line above.

Output strictly as a single JSON object:
{
  "nextAction": "one concrete action the rep should take next, with timing (e.g. \\"Call the office manager between 9-10am tomorrow\\")",
  "why": "2-3 sentences grounded in the recent activity + scorecard — why this action now",
  "talkTrack": "2-3 sentences the rep can use verbatim or as a starting point",
  "riskFlags": ["short bullet of risks or red flags the rep should know about", ...],
  "confidence": "high | medium | low — how confident you are this is the right move given the data"
}

If the activity history is empty or context is too thin to give a grounded recommendation, set confidence="low" and use nextAction to suggest the rep gather more context (research / discovery call / qualification scoring).`;

export type SalesCoachLeadInput = {
  businessName: string;
  industry: string;
  seatCount: number | null;
  addressCity: string | null;
  addressState: string | null;
  complianceDrivers: string[];
  currentMspName: string | null;
  currentMspSatisfaction: string;
  researchSummary: string | null;
  pipelineStage: string;
  servicesScore: number;
  customerScore: number;
  dealQualityScore: number;
  expectedCloseDate: string | null;
};

export type SalesCoachActivity = {
  type: string;
  subject: string;
  body: string | null;
  outcome: string | null;
  createdAt: Date;
};

export type SalesCoachInput = {
  lead: SalesCoachLeadInput;
  activities: SalesCoachActivity[];
  scorecard: Record<string, unknown> | null;
};

export type SalesCoachOutput = {
  nextAction: string;
  why: string;
  talkTrack: string;
  riskFlags: string[];
  confidence: "high" | "medium" | "low";
  raw: string;
};

export async function coachSale(
  input: SalesCoachInput,
  budget: { leadId: string; userId?: string },
): Promise<SalesCoachOutput> {
  const lead = input.lead;
  const ctx = [
    `Business: ${lead.businessName}`,
    `Industry: ${lead.industry}`,
    lead.seatCount ? `Seats: ${lead.seatCount}` : null,
    lead.addressCity || lead.addressState
      ? `Location: ${[lead.addressCity, lead.addressState].filter(Boolean).join(", ")}`
      : null,
    lead.complianceDrivers.length > 0 ? `Compliance: ${lead.complianceDrivers.join(", ")}` : null,
    lead.currentMspName ? `Current MSP: ${lead.currentMspName} (${lead.currentMspSatisfaction})` : null,
    `Pipeline stage: ${lead.pipelineStage}`,
    `Scorecard: services=${lead.servicesScore} / customer=${lead.customerScore} / deal-quality=${lead.dealQualityScore}`,
    lead.expectedCloseDate ? `Expected close: ${lead.expectedCloseDate}` : null,
    lead.researchSummary ? `\nResearch notes:\n${lead.researchSummary}` : null,
  ].filter(Boolean).join("\n");

  const activityBlock = input.activities.length === 0
    ? "(no activities logged yet)"
    : input.activities
        .slice(0, 20)
        .map((a) => {
          const date = a.createdAt.toISOString().slice(0, 10);
          const outcome = a.outcome ? ` [${a.outcome}]` : "";
          const body = a.body ? ` — ${a.body.slice(0, 200)}` : "";
          return `${date} · ${a.type}${outcome}: ${a.subject}${body}`;
        })
        .join("\n");

  const scoreBlock = input.scorecard
    ? `Manual qualification:\n${JSON.stringify(input.scorecard, null, 2).slice(0, 800)}`
    : "(no manual scorecard yet)";

  const user = `LEAD CONTEXT\n${ctx}\n\nRECENT ACTIVITY (newest first)\n${activityBlock}\n\nMANUAL SCORECARD\n${scoreBlock}`;
  const responseHint = `Return ONLY the JSON object — no markdown, no commentary.`;

  const profile = await loadProfile();
  const systemPrompt = `${renderMspProfileBlock(profile)}\n\n${TASK_INSTRUCTIONS}`;

  const { text } = await claudeCompletion({
    system: systemPrompt,
    user,
    responseHint,
    maxTokens: 1200,
    budget: { leadId: budget.leadId, userId: budget.userId, feature: AiFeatureKind.SALES_COACH },
  });

  let parsed: Partial<SalesCoachOutput> = {};
  try {
    const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned) as Partial<SalesCoachOutput>;
  } catch {
    parsed = {
      nextAction: text.slice(0, 300),
      why: "(parse fallback)",
      talkTrack: "",
      riskFlags: [],
      confidence: "low",
    };
  }

  return {
    nextAction: parsed.nextAction ?? "",
    why: parsed.why ?? "",
    talkTrack: parsed.talkTrack ?? "",
    riskFlags: Array.isArray(parsed.riskFlags) ? parsed.riskFlags : [],
    confidence: parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low",
    raw: text,
  };
}

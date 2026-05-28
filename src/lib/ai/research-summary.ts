/**
 * Lead research summarizer — calls Claude with a cached system prompt
 * (Gateway's nine markets + scoring philosophy) and a per-Lead user block.
 *
 * Returns a structured `{ summary, suggestedQuestions[], risks[] }` shape
 * parsed from JSON output. Falls back to free-form text when JSON parse fails.
 */

import { AiFeatureKind } from "@prisma/client";
import { claudeCompletion } from "@/lib/ai/anthropic";
import { loadProfile } from "@/lib/msp/loader";
import { renderMspProfileBlock } from "@/lib/msp/promptBlock";
import { loadCatalogBlock } from "@/lib/ai/catalog-grounding";

// v2.21 — system prompt is now assembled at call time from the MSP
// profile (companyName, mission, voice, services emphasis, win
// stories) + this task-specific instruction block. The MSP profile
// supplies the company identity that used to be hardcoded here.
const TASK_INSTRUCTIONS = `## Your job
You are a sales research analyst for the company described above.
Read Lead context and any gathered artifacts (website, LinkedIn,
Google Business) and produce a tight briefing for the salesperson
before her next conversation.

We score leads on three axes (Services fit, Customer fit, blended
Deal Quality). Be specific, brief, and prioritize signals that
change the deal score.

Output strictly as a single JSON object with this shape:
{
  "summary": "3-5 sentence narrative about who they are, what they do, and the most relevant tech context",
  "suggestedQuestions": ["question 1", "question 2", ...],
  "risks": ["red flag 1", ...],
  "fitSignals": ["signal that supports a fit with our services", ...]
}

Follow the Full-stack consideration rule from the company profile
above. fitSignals + suggestedQuestions should cover the full catalog
where relevant — phones (signs of legacy PBX, mobile workforce), access
control (multi-location, recent staff turnover, key-rekey costs),
video surveillance (insurance, liability, retail loss-prevention),
cabling (new builds, expansions), AI advisory (leaders publicly talking
about AI), vCIO retainer (no internal IT leadership) — not just
managed IT and cybersecurity. A research summary that talks only about
"security posture" when the website screams "we just opened 3 new
locations" is failing the rep.

Never invent facts not in the provided context. When context is thin,
say so in the summary and keep arrays empty.`;

export type ResearchSummaryInput = {
  lead: {
    businessName: string;
    industry: string;
    seatCount: number | null;
    siteCount: number;
    addressCity: string | null;
    addressState: string | null;
    websiteUrl: string | null;
    linkedinCompanyUrl: string | null;
    googleBusinessUrl: string | null;
    primaryContactName: string | null;
    primaryContactTitle: string | null;
    executiveSponsorName: string | null;
    currentMspName: string | null;
    currentMspSatisfaction: string;
    complianceDrivers: string[];
    researchSummary: string | null;
    // v3.3.11 — multi-service intake. AI uses these to anchor recs
    // beyond IT/cyber when the rep already captured signals.
    interestedServices?: string[];
    currentPhoneSystem?: string | null;
    currentPhonePainPoint?: string | null;
    currentAccessControl?: string | null;
    currentAccessDoorCount?: number | null;
    currentVideoSurveillance?: string | null;
    currentVideoCameraCount?: number | null;
    cablingStatus?: string | null;
    expansionPlans?: string | null;
    aiAdvisoryInterest?: string | null;
  };
  artifacts: Array<{
    type: string;
    sourceUrl: string | null;
    payload: unknown;
  }>;
};

export type ResearchSummaryOutput = {
  summary: string;
  suggestedQuestions: string[];
  risks: string[];
  fitSignals: string[];
  raw: string;
};

function artifactExcerpt(a: ResearchSummaryInput["artifacts"][number]): string {
  const p = a.payload as Record<string, unknown> | null;
  if (!p) return `[${a.type}] (no payload)`;
  const title = typeof p.title === "string" ? p.title : "";
  const text = typeof p.plainText === "string" ? p.plainText.slice(0, 1500) : "";
  const meta = typeof p.metaTags === "object" && p.metaTags
    ? Object.entries(p.metaTags as Record<string, string>).slice(0, 6).map(([k, v]) => `${k}=${v}`).join(" | ")
    : "";
  return `--- ${a.type} (${a.sourceUrl ?? "no-url"})\nTITLE: ${title}\nMETA: ${meta}\nTEXT: ${text}`;
}

export async function summarizeResearch(
  input: ResearchSummaryInput,
  // v2.20 — optional budget context. When provided, the call is
  // metered against per-lead + org caps and a usage row is written.
  budget?: { leadId: string; userId?: string },
): Promise<ResearchSummaryOutput> {
  const lead = input.lead;
  const ctxLines = [
    `Business: ${lead.businessName}`,
    `Industry: ${lead.industry}`,
    lead.seatCount ? `Employees/seats: ${lead.seatCount}` : null,
    `Locations: ${lead.siteCount}`,
    lead.addressCity || lead.addressState ? `Location: ${[lead.addressCity, lead.addressState].filter(Boolean).join(", ")}` : null,
    lead.websiteUrl ? `Website: ${lead.websiteUrl}` : null,
    lead.linkedinCompanyUrl ? `LinkedIn: ${lead.linkedinCompanyUrl}` : null,
    lead.googleBusinessUrl ? `Google Business: ${lead.googleBusinessUrl}` : null,
    lead.primaryContactName ? `Primary contact: ${lead.primaryContactName}${lead.primaryContactTitle ? `, ${lead.primaryContactTitle}` : ""}` : null,
    lead.executiveSponsorName ? `Executive sponsor: ${lead.executiveSponsorName}` : null,
    lead.currentMspName ? `Current MSP: ${lead.currentMspName} (${lead.currentMspSatisfaction})` : null,
    lead.complianceDrivers.length > 0 ? `Compliance drivers: ${lead.complianceDrivers.join(", ")}` : null,
    lead.researchSummary ? `Existing notes: ${lead.researchSummary}` : null,
    // v3.3.11 — multi-service intake: feed any signals the rep captured
    // so AI can incorporate them into the summary + questions + risks.
    lead.interestedServices && lead.interestedServices.length > 0
      ? `Services they showed interest in (rep-captured): ${lead.interestedServices.join(", ")}`
      : null,
    lead.currentPhoneSystem ? `Current phone system: ${lead.currentPhoneSystem}` : null,
    lead.currentPhonePainPoint ? `Phone pain point: ${lead.currentPhonePainPoint}` : null,
    lead.currentAccessControl
      ? `Access control today: ${lead.currentAccessControl}${
          lead.currentAccessDoorCount ? ` (${lead.currentAccessDoorCount} doors)` : ""
        }`
      : null,
    lead.currentVideoSurveillance
      ? `Video surveillance today: ${lead.currentVideoSurveillance}${
          lead.currentVideoCameraCount ? ` (${lead.currentVideoCameraCount} cameras)` : ""
        }`
      : null,
    lead.cablingStatus ? `Cabling status: ${lead.cablingStatus}` : null,
    lead.expansionPlans ? `Expansion plans: ${lead.expansionPlans}` : null,
    lead.aiAdvisoryInterest ? `AI advisory interest: ${lead.aiAdvisoryInterest}` : null,
  ].filter(Boolean).join("\n");

  const artifactBlock = input.artifacts.length === 0
    ? "(no gathered artifacts yet — work from Lead context only)"
    : input.artifacts.map(artifactExcerpt).join("\n\n");

  const user = `LEAD CONTEXT\n${ctxLines}\n\nGATHERED ARTIFACTS\n${artifactBlock}`;
  const responseHint = `Return ONLY the JSON object — no markdown, no commentary.`;

  // v2.21 — load MSP profile + assemble system prompt with company
  // identity + voice + services emphasis up front.
  // v3.3.14 — also inject the live service catalog so fitSignals /
  // suggestedQuestions / risks reference services we actually sell.
  const profile = await loadProfile();
  const catalogBlock = await loadCatalogBlock();
  const systemPrompt = `${renderMspProfileBlock(profile)}\n\n${catalogBlock}\n\n${TASK_INSTRUCTIONS}`;

  const { text } = await claudeCompletion({
    system: systemPrompt,
    user,
    responseHint,
    // 1200 was too tight: summary (3-5 sentences) + 3-5 questions +
    // risks + fitSignals routinely overran, the JSON got chopped mid-
    // string, parse failed, and the entire raw JSON ended up in the
    // summary box with empty card arrays. 2500 covers the worst case.
    maxTokens: 2500,
    budget: budget
      ? { leadId: budget.leadId, userId: budget.userId, feature: AiFeatureKind.RESEARCH_SUMMARY }
      : undefined,
  });

  let parsed: { summary?: string; suggestedQuestions?: string[]; risks?: string[]; fitSignals?: string[] } = {};
  const extracted = extractJsonObject(text);
  if (extracted) {
    try {
      parsed = JSON.parse(extracted) as typeof parsed;
    } catch {
      parsed = { summary: stripJsonScaffold(text) };
    }
  } else {
    parsed = { summary: stripJsonScaffold(text) };
  }

  return {
    summary: parsed.summary ?? "",
    suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    fitSignals: Array.isArray(parsed.fitSignals) ? parsed.fitSignals : [],
    raw: text,
  };
}

/**
 * Pull the first balanced top-level JSON object out of arbitrary model
 * output. Tolerates leading prose, ```json fences, trailing commentary,
 * and braces inside string literals. Returns null if no candidate found.
 */
function extractJsonObject(text: string): string | null {
  if (!text) return null;
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * If the model truncated mid-JSON and we couldn't parse, try not to
 * dump raw JSON syntax into the rep's summary textarea. Strip the
 * scaffolding so what remains is at least readable prose.
 */
function stripJsonScaffold(text: string): string {
  const cleaned = text
    .replace(/^```(json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const match = cleaned.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)/);
  const captured = match?.[1];
  if (captured) {
    try {
      return JSON.parse(`"${captured}"`) as string;
    } catch {
      return captured;
    }
  }
  return cleaned;
}

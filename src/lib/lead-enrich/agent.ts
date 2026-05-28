/**
 * v3.3.28 — Agentic OSINT research loop.
 *
 * Flow per Lead:
 *   1. Turn 0 (deterministic, free): seedScrape() runs the existing
 *      candidate-URL + sub-page crawl + JSON-LD + regex pipeline. No
 *      Claude tokens spent here.
 *   2. Turns 1..N (Claude with tool-use): build the system prompt with
 *      the MSP profile + service catalog + the briefing format spec,
 *      hand Claude the tool belt (web_search, fetch_url, find_emails,
 *      plus industry-affinity tools when Phase 2 lands), and iterate
 *      up to MAX_ROUNDS=7. Each tool call writes a ResearchArtifact.
 *   3. Final turn produces a single JSON briefing matching the shape
 *      consumed by `applyEnrichmentToLead`. Truncated / unparseable
 *      responses fall back gracefully (we keep what we can).
 */

import { Industry, AiFeatureKind } from "@prisma/client";
import { claudeToolLoop, isAnthropicConfigured } from "@/lib/ai/anthropic";
import { loadProfile } from "@/lib/msp/loader";
import { renderMspProfileBlock } from "@/lib/msp/promptBlock";
import { loadCatalogBlock } from "@/lib/ai/catalog-grounding";
import { seedScrape, type SeedScrapeResult } from "@/lib/lead-enrich/seed-scrape";
import { selectToolsFor, findTool, executeTool } from "@/lib/lead-enrich/tools";

// ---------------------------------------------------------------------------
// Briefing shape — matches `applyEnrichmentToLead` in persist.ts
// ---------------------------------------------------------------------------

export type AgentBriefing = {
  summary: string;
  fitSignals: string[];
  suggestedQuestions: string[];
  risks: string[];

  businessProfile?: {
    foundedYear?: number | null;
    estimatedAnnualRevenue?: string | null;
    employeeCountBand?: string | null;
    registeredEntityType?: string | null;
    charterIdentifiers?: {
      ncuaCharter?: string | null;
      fdicCert?: string | null;
      ein?: string | null;
      secCik?: string | null;
      dunsNumber?: string | null;
    } | null;
  };

  offices?: Array<{
    label?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    isPrimary?: boolean;
    isHQ?: boolean;
  }>;

  keyContacts?: Array<{
    name: string;
    title?: string | null;
    role?: string | null;
    email?: string | null;
    phone?: string | null;
    sourceUrl?: string | null;
    confidence?: number;
  }>;

  techFootprint?: {
    techStackHints?: string[];
    emailProvider?: string | null;
    websiteCms?: string | null;
    publicCertifications?: string[];
  };

  recentNews?: Array<{
    title: string;
    url: string;
    date?: string | null;
    summary?: string | null;
  }>;

  socialUrls?: {
    facebook?: string | null;
    twitter?: string | null;
    youtube?: string | null;
  };

  pressContactEmail?: string | null;

  sourcesUsed?: Array<{ url: string; why?: string | null }>;
};

export type AgentRunInput = {
  lead: {
    id: string;
    businessName: string;
    industry: Industry;
    websiteUrl: string | null;
    addressCity: string | null;
    addressState: string | null;
    seatCount: number | null;
    siteCount: number;
    primaryContactName: string | null;
  };
  userId?: string;
};

export type AgentRunOutput = {
  briefing: AgentBriefing | null;
  seedResult: SeedScrapeResult;
  rounds: number;
  stopReason: string;
  rawText: string;
};

const MAX_ROUNDS = 7;

// ---------------------------------------------------------------------------
// Task-specific instruction block (system prompt suffix)
// ---------------------------------------------------------------------------

const TASK_INSTRUCTIONS = `## Your job
You are an OSINT research agent for a Gateway TelNet sales rep. Produce a
factual briefing about ONE lead. Use the provided tools. Never invent
facts not present in tool output or in the INITIAL FINDINGS block.

## Strategy
1. Read INITIAL FINDINGS first. The deterministic seed-scrape already ran
   — if it answered the brief, skip directly to the final JSON.
2. Otherwise plan 2-4 targeted tool calls. Prefer in this order:
   - An industry-specific lookup tool if one exists for this lead's
     industry (e.g., lookup_credit_union for CREDIT_UNION). These are
     authoritative and bypass Cloudflare-protected homepages entirely.
   - web_search to find news, leadership, tech-stack mentions, OR to
     route around Cloudflare-blocked homepages (search the business name
     + city, then read directory-site snippets).
   - fetch_url on the 1-2 most promising web_search results.
   - find_emails(domain) once you've confirmed the canonical domain.
3. Stop calling tools as soon as you can fill the briefing.

## Budget
At most 7 tool calls total. Be deliberate.

## Formatting — use markdown to draw the rep's eye
The Research tab + Overview "Research signals" card render every string
field below as markdown. Use light, intentional formatting so the rep can
skim the briefing in 5 seconds and spot what matters:

  - **bold** — for 2-4 of the highest-attention phrases per briefing.
    Reserve it for things that change the sales motion: a *compelling
    event* (recent funding/audit/breach/leadership change), a hard
    number (employee count, asset size, branch count), a time-sensitive
    signal (renewal date, audit deadline), or a hot service angle
    (jitter on existing VoIP, expired SSL, M365 tenancy → IT crossover).
    Do NOT bold every sentence — boldness is information, not decoration.
  - *italic* — for soft callouts and nuance (existing tooling that's
    "good enough", a geo/jurisdiction note, an inferred-but-not-confirmed
    detail).
  - \`code\` — for specific vendor names, model numbers, technical
    identifiers, or domains (e.g. \`Microsoft 365\`, \`Cloudflare\`,
    \`lapfcu.org\`, \`NCUA charter 13345\`).
  - [link text](url) — when you reference a specific source (news
    article, 10-K filing, NCUA page) so the rep can click through. Cite,
    don't just assert.
  - Bullet lists (\`- item\`) inside the summary when listing 3+ items.
  - Do NOT use headings (\`#\`, \`##\`) — surfaces are too compact.
  - Do NOT use images, raw HTML, or block code fences.

### Example summary formatting (LAPFCU-class credit union)
\`\`\`
**LAPFCU** is a **15-seat** single-branch credit union in Van Nuys, CA
serving LAPD employees and families. As a federally-chartered CU under
**NCUA charter 13345** with **$1.2B in assets**, they carry standard
PCI + NCUA exam obligations — *compliance posture is a real driver, not
just a selling angle*. Tech: rep captured \`RingCentral\` jitter
(**warm VoIP displacement opportunity**) plus an existing 24-camera NVR
that's *likely compliance-driven*. MX records show \`Microsoft 365\`,
suggesting IT services already partially outsourced. Most recent press:
[new branch in Burbank announced Q4 2025](https://example.com/news).
\`\`\`

### Example bullet formatting (Fit signals)
\`\`\`
[
  "**Compliance driver:** NCUA + PCI obligations make managed cyber a procurement priority",
  "**Warm VoIP displacement:** rep already noted \`RingCentral\` jitter pain",
  "*Possible vCIO fit:* no internal IT leadership visible on About page"
]
\`\`\`

## Output format — STRICT
When ready, produce ONLY a single JSON object — no markdown OUTSIDE the
string values, no commentary before or after. Markdown belongs INSIDE
the string field values per the formatting guidance above. Any field you
didn't find should be null (scalars) or [] (arrays). NEVER invent a
value just to fill a slot.

{
  "summary": "5-7 sentences with selective **bold** on attention-worthy phrases. Lead with the most concrete fact.",
  "fitSignals": ["**Label:** why this lead fits a Gateway service", ...],
  "suggestedQuestions": ["What to ask on the next call (plain prose; bold sparingly for the key noun)", ...],
  "risks": ["**Red flag:** specifics", ...],

  "businessProfile": {
    "foundedYear": null,
    "estimatedAnnualRevenue": null,
    "employeeCountBand": null,
    "registeredEntityType": null,
    "charterIdentifiers": {
      "ncuaCharter": null, "fdicCert": null, "ein": null,
      "secCik": null, "dunsNumber": null
    }
  },
  "offices": [
    { "label": null, "address": null, "city": null, "state": null,
      "zip": null, "isPrimary": false, "isHQ": false }
  ],
  "keyContacts": [
    { "name": "string", "title": null, "role": null,
      "email": null, "phone": null, "sourceUrl": null, "confidence": 0.0 }
  ],
  "techFootprint": {
    "techStackHints": [], "emailProvider": null,
    "websiteCms": null, "publicCertifications": []
  },
  "recentNews": [
    { "title": "string", "url": "string", "date": null, "summary": null }
  ],
  "socialUrls": { "facebook": null, "twitter": null, "youtube": null },
  "pressContactEmail": null,
  "sourcesUsed": [{ "url": "string", "why": "string" }]
}`;

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function runResearchAgent(input: AgentRunInput): Promise<AgentRunOutput> {
  // ---- Turn 0: seed-scrape (no Claude tokens) ----
  const seedResult = await seedScrape(
    {
      businessName: input.lead.businessName,
      websiteUrl: input.lead.websiteUrl,
      addressCity: input.lead.addressCity,
      addressState: input.lead.addressState,
    },
    { maxCandidates: 6, maxSubPages: 4 },
  );

  // If Claude isn't configured, we still return what the seed-scrape
  // produced so the gather route can persist regex hits.
  if (!isAnthropicConfigured()) {
    return {
      briefing: null,
      seedResult,
      rounds: 0,
      stopReason: "anthropic_not_configured",
      rawText: "",
    };
  }

  // ---- Build the system prompt ----
  const [profile, catalogBlock] = await Promise.all([loadProfile(), loadCatalogBlock()]);
  const systemPrompt =
    `${renderMspProfileBlock(profile)}\n\n${catalogBlock}\n\n${TASK_INSTRUCTIONS}`;

  // ---- Compose the INITIAL FINDINGS block from the seed-scrape ----
  const initialFindings = buildInitialFindings(seedResult, input);

  const userMessage = `LEAD CONTEXT
Business: ${input.lead.businessName}
Industry: ${input.lead.industry}
Location: ${[input.lead.addressCity, input.lead.addressState].filter(Boolean).join(", ") || "(unknown)"}
Website (rep input): ${input.lead.websiteUrl ?? "(none)"}
Seat count (rep input): ${input.lead.seatCount ?? "(unknown)"}
Site count (rep input): ${input.lead.siteCount}
Primary contact (rep input): ${input.lead.primaryContactName ?? "(unknown)"}

INITIAL FINDINGS (turn 0 — already gathered, no further fetch needed for these)
${initialFindings}`;

  // ---- Pick tools (industry-aware reorder) ----
  const tools = selectToolsFor({ industry: input.lead.industry });
  const toolSpecs = tools.map((t) => t.spec);

  // ---- Drive the loop ----
  const ctx = { leadId: input.lead.id, userId: input.userId };
  const result = await claudeToolLoop({
    system: systemPrompt,
    user: userMessage,
    tools: toolSpecs,
    maxRounds: MAX_ROUNDS,
    maxTokensPerTurn: 2500,
    budget: { leadId: input.lead.id, userId: input.userId, feature: AiFeatureKind.RESEARCH_SUMMARY },
    async onToolCall(call) {
      const def = findTool(call.name);
      if (!def) {
        return {
          tool_use_id: call.id,
          content: `ERROR: unknown tool "${call.name}". Available tools: ${toolSpecs.map((t) => t.name).join(", ")}`,
          isError: true,
        };
      }
      return executeTool(def, call, ctx);
    },
  });

  // ---- Parse the final text into a briefing ----
  const briefing = parseBriefing(result.text);

  return {
    briefing,
    seedResult,
    rounds: result.rounds,
    stopReason: result.stopReason,
    rawText: result.text,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildInitialFindings(s: SeedScrapeResult, input: AgentRunInput): string {
  const out: string[] = [];

  if (s.homepage) {
    out.push(`Homepage found: ${s.homepage}`);
  } else {
    out.push(`Homepage: NOT FOUND. Rep URL failed (or absent), candidate URLs failed, and DDG search returned nothing usable. The site may be Cloudflare-protected (try web_search instead) or the business may not have a public website.`);
  }

  out.push(`Pages scraped: ${s.pages.length}${s.pages.length > 0 ? ` (${s.pages.map((p) => p.kind).join(", ")})` : ""}`);

  if (Object.keys(s.structuredFacts).length > 0) {
    out.push(`Structured (JSON-LD) facts:\n${JSON.stringify(s.structuredFacts, null, 2).slice(0, 2000)}`);
  } else {
    out.push("Structured (JSON-LD) facts: (none — no schema.org markup found)");
  }

  const harvestLines: string[] = [];
  if (s.regexHits.phones.length > 0) harvestLines.push(`Phones: ${s.regexHits.phones.slice(0, 4).join(", ")}`);
  if (s.regexHits.emails.length > 0) harvestLines.push(`Emails: ${s.regexHits.emails.slice(0, 6).join(", ")}`);
  if (s.regexHits.linkedinUrls.length > 0) harvestLines.push(`LinkedIn URLs (manual reference): ${s.regexHits.linkedinUrls.slice(0, 3).join(", ")}`);
  if (s.regexHits.foundedYearHints.length > 0) harvestLines.push(`Founded-year hints: ${s.regexHits.foundedYearHints.join(", ")}`);
  if (s.regexHits.seatCountHints.length > 0) harvestLines.push(`Seat-count hints: ${s.regexHits.seatCountHints.join(", ")}`);
  if (harvestLines.length > 0) {
    out.push("Regex harvest:\n" + harvestLines.map((l) => `  - ${l}`).join("\n"));
  }

  if (s.pages.length > 0) {
    const excerpts = s.pages
      .map((p) => `### ${p.kind.toUpperCase()} — ${p.url}\n${p.text.slice(0, 1500)}`)
      .join("\n\n---\n\n")
      .slice(0, 8000);
    out.push(`Page excerpts (first 1.5KB each):\n${excerpts}`);
  }

  if (s.sourcesFailed.length > 0) {
    out.push(
      `Sources that failed: ` +
        s.sourcesFailed.map((f) => `${f.url} (${f.reason})`).join("; ").slice(0, 600),
    );
  }

  // Brief context on what's already known so the agent doesn't waste a
  // tool call rediscovering rep-captured intake.
  if (input.lead.industry) {
    out.push(`Reminder: industry is ${input.lead.industry} — if an industry-specific lookup tool exists, prefer it.`);
  }

  return out.join("\n\n");
}

/**
 * Tolerant parser: extract the first balanced top-level JSON object from
 * whatever Claude produced. Same brace-balanced approach used in
 * research-summary.ts so partial / fenced output still works.
 */
function parseBriefing(text: string): AgentBriefing | null {
  if (!text) return null;
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as AgentBriefing;
  } catch {
    return null;
  }
}

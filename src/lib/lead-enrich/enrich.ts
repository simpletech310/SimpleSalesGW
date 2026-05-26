/**
 * v3.3.9 — Lead enrichment via OSINT + Claude inference.
 *
 * Takes whatever the rep has (often just a business name + maybe a city
 * or a URL) and tries to fill the rest of the Lead form: website,
 * phones, emails, owner name, employee count, locations, industry,
 * social links, address.
 *
 * Pipeline:
 *   1. Discover the homepage if not provided (try the most-likely URLs).
 *   2. Scrape it + the most useful sub-pages (/about, /contact, /team).
 *   3. Extract phones + emails + social links + addresses via regex
 *      from the combined plain text.
 *   4. Ask Claude to synthesize structured Lead fields from the gathered
 *      data plus the rep's seed input.
 *   5. Return one EnrichedField per Lead column with value + confidence
 *      + source (website / contact-page / claude / seed) so the UI can
 *      show provenance and the rep can accept individual fields.
 *
 * Everything is best-effort and idempotent. If we can't find a thing,
 * the field is omitted and the rep keeps their original value.
 */

import { AiFeatureKind, Industry } from "@prisma/client";
import { claudeCompletion, isAnthropicConfigured } from "@/lib/ai/anthropic";
import { fetchPage } from "@/lib/scrape/fetch-page";

export type EnrichSeed = {
  businessName: string;
  websiteUrl?: string | null;
  addressStreet?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZip?: string | null;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
};

type Source = "seed" | "website" | "claude" | "regex";

export type EnrichedField<T> = {
  value: T;
  /** 0-1, rough confidence (regex hits → 0.7, claude → 0.6, seed → 1). */
  confidence: number;
  source: Source;
  /** Optional: which URL this came from. */
  sourceUrl?: string;
};

export type EnrichmentResult = {
  /** Per-field proposals. Undefined fields = nothing to suggest. */
  fields: Partial<{
    businessName: EnrichedField<string>;
    dbaName: EnrichedField<string>;
    industry: EnrichedField<Industry>;
    subindustry: EnrichedField<string>;
    seatCount: EnrichedField<number>;
    siteCount: EnrichedField<number>;
    addressStreet: EnrichedField<string>;
    addressCity: EnrichedField<string>;
    addressState: EnrichedField<string>;
    addressZip: EnrichedField<string>;
    websiteUrl: EnrichedField<string>;
    linkedinCompanyUrl: EnrichedField<string>;
    googleBusinessUrl: EnrichedField<string>;
    primaryContactName: EnrichedField<string>;
    primaryContactTitle: EnrichedField<string>;
    primaryContactEmail: EnrichedField<string>;
    primaryContactPhone: EnrichedField<string>;
    executiveSponsorName: EnrichedField<string>;
    executiveSponsorTitle: EnrichedField<string>;
    currentMspName: EnrichedField<string>;
  }>;
  /** Sources we successfully pulled, for the UI to attribute. */
  sourcesUsed: Array<{ url: string; kind: "homepage" | "about" | "contact" | "team" | "candidate"; bytes: number }>;
  /** Sources we tried but couldn't pull, with reasons. */
  sourcesFailed: Array<{ url: string; reason: string }>;
  /** AI narrative summary of what we found (5-7 sentences). */
  narrative: string;
  /** Concrete gaps the rep should fill manually — what we still don't know. */
  gaps: string[];
  /** Free-form raw text aggregated from sources, truncated. For debugging. */
  rawText: string;
};

// ---------------------------------------------------------------------------
// 1. Candidate URL discovery
// ---------------------------------------------------------------------------

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
}

function dashify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/**
 * Build a list of likely homepage URLs from a business name. Cheap
 * heuristic — most SMBs use one of these patterns. Caller fetches them
 * in order and stops at the first 200.
 */
export function candidateHomepages(businessName: string): string[] {
  const slug = slugify(businessName);
  const dashed = dashify(businessName);
  const out: string[] = [];
  if (slug) {
    out.push(`https://${slug}.com`);
    out.push(`https://www.${slug}.com`);
    out.push(`https://${slug}.net`);
  }
  if (dashed && dashed !== slug) {
    out.push(`https://${dashed}.com`);
    out.push(`https://www.${dashed}.com`);
  }
  return Array.from(new Set(out));
}

// ---------------------------------------------------------------------------
// 2. Sub-page discovery
// ---------------------------------------------------------------------------

const SUB_PATHS = ["/about", "/about-us", "/contact", "/contact-us", "/team", "/leadership", "/locations"];

function subUrls(base: string): string[] {
  try {
    const u = new URL(base);
    return SUB_PATHS.map((p) => new URL(p, u).toString());
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// 3. Regex extraction from plain text
// ---------------------------------------------------------------------------

const PHONE_RE = /(?:\+?1[\s.-]?)?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const LINKEDIN_RE = /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9_-]+/gi;
const GOOG_RE = /https?:\/\/(?:www\.)?google\.com\/maps\/place\/[^\s"'<>]+/gi;
const ZIP_RE = /\b(\d{5})(?:-\d{4})?\b/g;
const STATE_RE = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/g;

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return null;
}

function uniqueMatches(re: RegExp, text: string, limit = 10): string[] {
  re.lastIndex = 0;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) != null && out.size < limit) {
    out.add(m[0]);
  }
  return Array.from(out);
}

export type RegexHarvest = {
  phones: string[];
  emails: string[];
  linkedinUrls: string[];
  googleMapsUrls: string[];
  zips: string[];
  stateCodes: string[];
};

export function harvestFromText(text: string): RegexHarvest {
  const phonesRaw = uniqueMatches(PHONE_RE, text, 12);
  const phones = phonesRaw
    .map(normalizePhone)
    .filter((p): p is string => p != null);
  return {
    phones: Array.from(new Set(phones)).slice(0, 6),
    emails: uniqueMatches(EMAIL_RE, text, 12)
      // Filter out obvious noise: tracking pixels, asset domains, common false positives
      .filter((e) => !/@(sentry|wixpress|wix|cloudinary|google|facebook|gstatic|noreply|do-not-reply)\./i.test(e))
      .slice(0, 6),
    linkedinUrls: uniqueMatches(LINKEDIN_RE, text, 4),
    googleMapsUrls: uniqueMatches(GOOG_RE, text, 4),
    zips: uniqueMatches(ZIP_RE, text, 6),
    stateCodes: uniqueMatches(STATE_RE, text, 6),
  };
}

// ---------------------------------------------------------------------------
// 4. Claude inference — synthesize Lead fields from the gathered context
// ---------------------------------------------------------------------------

const INFER_PROMPT = `## Your job
You are an OSINT analyst helping a sales rep populate a Lead record.

You will be given:
  - The rep's seed input (whatever they typed — usually a business name, sometimes a city, address, or partial contact)
  - Scraped plain text from the company's website + sub-pages
  - Phone numbers, emails, and social links pulled by regex

Your task: synthesize a structured Lead record. Pull from the scraped
text first; fall back to general knowledge only when the website
clearly identifies the company. NEVER invent contact info that doesn't
appear in the scraped text or the regex hits.

Output STRICTLY as a single JSON object. Use null for any field you
genuinely can't determine. Do not include extra commentary, markdown,
or code fences:

{
  "businessName": "official legal or commonly-used name",
  "dbaName": "DBA / trade name if different",
  "industry": "MEDICAL | LEGAL | FEDERAL_CONTRACTING | MANUFACTURING | HOSPITALITY | FINANCIAL_SERVICES | PROFESSIONAL_SERVICES | EDUCATION | NONPROFIT | OTHER",
  "subindustry": "more specific niche, plain text",
  "seatCount": <integer estimate of employees who would need IT — null if unknown>,
  "siteCount": <integer number of offices / locations — default 1 if single-location>,
  "addressStreet": "...",
  "addressCity": "...",
  "addressState": "two-letter state code",
  "addressZip": "...",
  "websiteUrl": "the canonical https://... homepage",
  "linkedinCompanyUrl": "https://www.linkedin.com/company/... (only if found)",
  "googleBusinessUrl": "Google Maps place URL (only if found in scraped text)",
  "primaryContactName": "owner / founder / managing partner — pick the most senior named individual on the website",
  "primaryContactTitle": "their title verbatim",
  "primaryContactEmail": "must come from the scraped text or regex hits — do not invent",
  "primaryContactPhone": "must come from the scraped text or regex hits — do not invent",
  "executiveSponsorName": "C-level decision maker if different from primary contact, otherwise null",
  "executiveSponsorTitle": "...",
  "currentMspName": "current IT vendor if mentioned, otherwise null",
  "narrative": "5-7 sentence plain-English brief on who they are, what they do, scale, locations, and what stands out for a sales rep to know going into a discovery call",
  "gaps": ["bullets describing concrete things you couldn't determine that the rep should ask about — e.g. 'seat count not on website', 'no executive sponsor identified'", ...]
}

Rules:
  - industry MUST be one of the listed enum values
  - When a phone or email appears multiple times, prefer the one that looks like a main / front-desk line vs. an individual employee
  - When picking primaryContactName, prefer 'Owner', 'Founder', 'Principal', 'CEO', 'President', 'Managing Partner' from the scraped text
  - If the website has a 'Locations' page listing 5 addresses, set siteCount to 5
  - seatCount is best-effort: 'family-owned' / 'small team' = 5-15; 'X+ employees' on website = the X; LinkedIn-style ranges treated as midpoint
  - If a state is mentioned only in a ZIP code, infer the state from the ZIP`;

type InferredFields = {
  businessName?: string | null;
  dbaName?: string | null;
  industry?: string | null;
  subindustry?: string | null;
  seatCount?: number | null;
  siteCount?: number | null;
  addressStreet?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZip?: string | null;
  websiteUrl?: string | null;
  linkedinCompanyUrl?: string | null;
  googleBusinessUrl?: string | null;
  primaryContactName?: string | null;
  primaryContactTitle?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  executiveSponsorName?: string | null;
  executiveSponsorTitle?: string | null;
  currentMspName?: string | null;
  narrative?: string | null;
  gaps?: string[] | null;
};

function safeJsonParse(text: string): unknown | null {
  const stripped = text.trim().replace(/```(?:json)?/gi, "").replace(/```$/g, "").trim();
  try { return JSON.parse(stripped); } catch { /* fall through */ }
  const first = stripped.indexOf("{");
  const last = stripped.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return JSON.parse(stripped.slice(first, last + 1)); } catch { /* fall through */ }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 5. Public entry point
// ---------------------------------------------------------------------------

export async function enrichLead(
  seed: EnrichSeed,
  opts: { userId?: string; maxSubPages?: number; maxCandidates?: number } = {},
): Promise<EnrichmentResult> {
  const maxSubPages = opts.maxSubPages ?? 3;
  const maxCandidates = opts.maxCandidates ?? 4;

  const sourcesUsed: EnrichmentResult["sourcesUsed"] = [];
  const sourcesFailed: EnrichmentResult["sourcesFailed"] = [];
  const collected: Array<{ url: string; kind: EnrichmentResult["sourcesUsed"][number]["kind"]; text: string }> = [];

  // 1. Pick the homepage URL — seed wins; otherwise try candidates
  let homepage: string | null = seed.websiteUrl?.trim() || null;
  if (!homepage) {
    const candidates = candidateHomepages(seed.businessName).slice(0, maxCandidates);
    for (const c of candidates) {
      const r = await fetchPage(c);
      if (r.ok) {
        homepage = r.finalUrl;
        collected.push({ url: r.finalUrl, kind: "candidate", text: r.page.plainText });
        sourcesUsed.push({ url: r.finalUrl, kind: "candidate", bytes: r.bytes });
        break;
      } else {
        sourcesFailed.push({ url: c, reason: r.reason });
      }
    }
  } else {
    const r = await fetchPage(homepage);
    if (r.ok) {
      homepage = r.finalUrl;
      collected.push({ url: r.finalUrl, kind: "homepage", text: r.page.plainText });
      sourcesUsed.push({ url: r.finalUrl, kind: "homepage", bytes: r.bytes });
    } else {
      sourcesFailed.push({ url: homepage, reason: r.reason });
      homepage = null;
    }
  }

  // 2. Pull sub-pages most likely to carry contact / team info
  if (homepage) {
    const subs = subUrls(homepage).slice(0, maxSubPages);
    // Sequential — we keep concurrency low to stay polite + within timeouts
    for (const u of subs) {
      const r = await fetchPage(u);
      if (r.ok) {
        const kind: EnrichmentResult["sourcesUsed"][number]["kind"] =
          /about/i.test(u) ? "about" :
          /contact/i.test(u) ? "contact" :
          /team|leadership/i.test(u) ? "team" :
          "homepage";
        collected.push({ url: r.finalUrl, kind, text: r.page.plainText });
        sourcesUsed.push({ url: r.finalUrl, kind, bytes: r.bytes });
      } else {
        // Don't record subpage 404s as failures — most sites only have a subset
        if (!r.reason.startsWith("http_404")) {
          sourcesFailed.push({ url: u, reason: r.reason });
        }
      }
    }
  }

  // 3. Regex harvest from the combined corpus
  const combined = collected.map((c) => c.text).join("\n\n").slice(0, 24000);
  const harvest = harvestFromText(combined);

  // 4. Claude inference (skip silently if not configured — regex/seed still wins)
  let inferred: InferredFields = {};
  if (isAnthropicConfigured() && (combined.length > 100 || homepage)) {
    const seedBlock = [
      `Business name (rep input): ${seed.businessName}`,
      seed.websiteUrl ? `Website (rep input): ${seed.websiteUrl}` : null,
      seed.addressCity || seed.addressState
        ? `Address hint: ${[seed.addressStreet, seed.addressCity, seed.addressState, seed.addressZip].filter(Boolean).join(", ")}`
        : null,
      seed.primaryContactName ? `Contact (rep input): ${seed.primaryContactName}` : null,
    ].filter(Boolean).join("\n");

    const regexBlock = [
      harvest.phones.length > 0 ? `Phones found: ${harvest.phones.join(", ")}` : null,
      harvest.emails.length > 0 ? `Emails found: ${harvest.emails.join(", ")}` : null,
      harvest.linkedinUrls.length > 0 ? `LinkedIn URLs: ${harvest.linkedinUrls.join(", ")}` : null,
      harvest.googleMapsUrls.length > 0 ? `Google Maps URLs: ${harvest.googleMapsUrls.join(", ")}` : null,
    ].filter(Boolean).join("\n");

    const scrapeBlock = collected
      .map((c) => `### ${c.kind.toUpperCase()} (${c.url})\n${c.text.slice(0, 4000)}`)
      .join("\n\n---\n\n")
      .slice(0, 18000);

    const user = `SEED INPUT\n${seedBlock}\n\nREGEX HITS\n${regexBlock || "(none)"}\n\nSCRAPED PAGES\n${scrapeBlock || "(no pages scraped)"}`;
    try {
      const { text } = await claudeCompletion({
        system: INFER_PROMPT,
        user,
        responseHint: "Return ONLY the JSON object — no markdown, no commentary, your ENTIRE response is the JSON object.",
        maxTokens: 2000,
        budget: opts.userId
          ? { userId: opts.userId, feature: AiFeatureKind.RESEARCH_SUMMARY }
          : undefined,
      });
      const parsed = safeJsonParse(text);
      if (parsed && typeof parsed === "object") {
        inferred = parsed as InferredFields;
      }
    } catch (e) {
      console.error("[lead-enrich] claude inference failed:", (e as Error).message);
    }
  }

  // 5. Assemble per-field proposals. Seed always wins (rep typed it).
  // Otherwise prefer Claude > regex when both have a value.
  const fields: EnrichmentResult["fields"] = {};
  function set<K extends keyof EnrichmentResult["fields"]>(
    key: K,
    value: NonNullable<EnrichmentResult["fields"][K]>["value"],
    source: Source,
    confidence: number,
    sourceUrl?: string,
  ) {
    const v = value as never;
    (fields as Record<string, EnrichedField<unknown>>)[key as string] = { value: v, source, confidence, sourceUrl };
  }

  // Website — only propose if we discovered it (seed already had it = no proposal)
  if (homepage && !seed.websiteUrl) {
    set("websiteUrl", homepage, "website", 0.95, homepage);
  }

  // Phones / emails — prefer Claude's pick; fall back to first regex hit.
  if (inferred.primaryContactPhone && /[\d]/.test(inferred.primaryContactPhone)) {
    const normalized = normalizePhone(inferred.primaryContactPhone) ?? inferred.primaryContactPhone;
    set("primaryContactPhone", normalized, "claude", 0.7);
  } else {
    const firstPhone = harvest.phones[0];
    if (firstPhone && !seed.primaryContactPhone) {
      set("primaryContactPhone", firstPhone, "regex", 0.6);
    }
  }
  if (inferred.primaryContactEmail && /@/.test(inferred.primaryContactEmail)) {
    set("primaryContactEmail", inferred.primaryContactEmail, "claude", 0.7);
  } else {
    const firstEmail = harvest.emails[0];
    if (firstEmail && !seed.primaryContactEmail) {
      set("primaryContactEmail", firstEmail, "regex", 0.6);
    }
  }

  if (inferred.linkedinCompanyUrl && /linkedin\.com/.test(inferred.linkedinCompanyUrl)) {
    set("linkedinCompanyUrl", inferred.linkedinCompanyUrl, "claude", 0.8);
  } else {
    const firstLi = harvest.linkedinUrls[0];
    if (firstLi) set("linkedinCompanyUrl", firstLi, "regex", 0.7);
  }
  if (inferred.googleBusinessUrl && /google\.com\/maps/.test(inferred.googleBusinessUrl)) {
    set("googleBusinessUrl", inferred.googleBusinessUrl, "claude", 0.8);
  } else {
    const firstGoog = harvest.googleMapsUrls[0];
    if (firstGoog) set("googleBusinessUrl", firstGoog, "regex", 0.7);
  }

  // Address bits — use Claude when it has them and seed is empty
  function maybeStr<K extends keyof EnrichmentResult["fields"]>(
    key: K,
    inferredVal: string | null | undefined,
    seedVal: string | null | undefined,
    conf = 0.7,
  ) {
    if (!seedVal && inferredVal && inferredVal.trim()) {
      set(key, inferredVal.trim() as never, "claude", conf);
    }
  }
  maybeStr("addressStreet", inferred.addressStreet, seed.addressStreet);
  maybeStr("addressCity", inferred.addressCity, seed.addressCity);
  maybeStr("addressState", inferred.addressState, seed.addressState);
  maybeStr("addressZip", inferred.addressZip, seed.addressZip);
  maybeStr("primaryContactName", inferred.primaryContactName, seed.primaryContactName, 0.65);
  maybeStr("primaryContactTitle", inferred.primaryContactTitle, null, 0.65);
  maybeStr("executiveSponsorName", inferred.executiveSponsorName, null, 0.55);
  maybeStr("executiveSponsorTitle", inferred.executiveSponsorTitle, null, 0.55);
  maybeStr("currentMspName", inferred.currentMspName, null, 0.5);
  maybeStr("dbaName", inferred.dbaName, null, 0.55);
  maybeStr("subindustry", inferred.subindustry, null, 0.6);

  // Industry — only set if Claude's value matches our enum
  if (inferred.industry && (Object.values(Industry) as string[]).includes(inferred.industry)) {
    set("industry", inferred.industry as Industry, "claude", 0.75);
  }

  // Numeric fields
  if (typeof inferred.seatCount === "number" && inferred.seatCount > 0) {
    set("seatCount", Math.round(inferred.seatCount), "claude", 0.55);
  }
  if (typeof inferred.siteCount === "number" && inferred.siteCount > 0) {
    set("siteCount", Math.round(inferred.siteCount), "claude", 0.7);
  }

  // Business name — only suggest if Claude found a more canonical form
  if (inferred.businessName && inferred.businessName.trim() && inferred.businessName.trim() !== seed.businessName.trim()) {
    set("businessName", inferred.businessName.trim(), "claude", 0.7);
  }

  return {
    fields,
    sourcesUsed,
    sourcesFailed,
    narrative: typeof inferred.narrative === "string" ? inferred.narrative : "",
    gaps: Array.isArray(inferred.gaps)
      ? inferred.gaps.filter((g): g is string => typeof g === "string" && g.trim().length > 0)
      : [],
    rawText: combined.slice(0, 4000),
  };
}

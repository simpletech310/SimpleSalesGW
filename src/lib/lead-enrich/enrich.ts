/**
 * v3.3.17 — Lead enrichment via OSINT + structured-data extraction + AI inference.
 *
 * Massively upgraded from v3.3.9. Pipeline now:
 *
 *   1. Discover the homepage. Try the rep's URL first; if absent, try
 *      8+ candidate URLs (incl. variants that drop LLC/Inc/Co
 *      suffixes); if those all fail, search DuckDuckGo with name + city
 *      and pick the top non-directory hit.
 *
 *   2. Scrape homepage + auto-discover same-domain sub-pages from its
 *      nav/footer links (matching slugs like /about /services /team /
 *      contact /staff /locations /our-story /leadership /management).
 *      Fall back to a fixed list of common slugs if the homepage didn't
 *      give us enough.
 *
 *   3. Parse each page for:
 *      - title + meta tags (incl. OpenGraph, Twitter Card)
 *      - JSON-LD structured data (schema.org Organization /
 *        LocalBusiness / Person — gives us reliable legal name, address,
 *        phone, employees, founder, social URLs without guessing)
 *      - plain text
 *      - regex hits: phones, emails, LinkedIn URLs, Google Maps URLs
 *
 *   4. Pre-compute StructuredFacts from JSON-LD across all scraped
 *      pages — that's our highest-confidence source. AI gets it as a
 *      separate block in the prompt.
 *
 *   5. Ask Claude to synthesize structured Lead fields using:
 *      - Rep's seed input
 *      - StructuredFacts (highest confidence — pretty much copy through)
 *      - Regex hits (medium confidence)
 *      - Scraped plain text (lowest confidence — for inference like
 *        seat count, expansion plans, AI mentions, phone-system pain)
 *
 *   6. Return per-field proposals with confidence + source attribution
 *      so the rep can accept individually.
 *
 * Everything is best-effort and idempotent. If we can't find a thing,
 * the field is omitted and the rep keeps their original value.
 */

import { AiFeatureKind, Industry, ServiceLine } from "@prisma/client";
import { claudeCompletion, isAnthropicConfigured } from "@/lib/ai/anthropic";
import { fetchPage } from "@/lib/scrape/fetch-page";
import { structuredFactsFrom, type StructuredFacts } from "@/lib/scrape/extract";
import { findHomepageBySearch } from "@/lib/scrape/search";

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

type Source = "seed" | "website" | "claude" | "regex" | "jsonld" | "ddg";

export type EnrichedField<T> = {
  value: T;
  /** 0-1 rough confidence: jsonld > regex > claude > inferred. */
  confidence: number;
  source: Source;
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
    // v3.3.17 — multi-service intake proposals from scrape
    interestedServices: EnrichedField<ServiceLine[]>;
    currentPhoneSystem: EnrichedField<string>;
    currentPhonePainPoint: EnrichedField<string>;
    currentAccessControl: EnrichedField<string>;
    currentVideoSurveillance: EnrichedField<string>;
    cablingStatus: EnrichedField<string>;
    expansionPlans: EnrichedField<string>;
    aiAdvisoryInterest: EnrichedField<string>;
  }>;
  sourcesUsed: Array<{ url: string; kind: "homepage" | "about" | "contact" | "team" | "services" | "locations" | "candidate" | "ddg"; bytes: number }>;
  sourcesFailed: Array<{ url: string; reason: string }>;
  narrative: string;
  gaps: string[];
  rawText: string;
};

// ---------------------------------------------------------------------------
// 1. Candidate URL discovery — expanded
// ---------------------------------------------------------------------------

function stripBusinessSuffix(name: string): string {
  return name
    .replace(/\b(llc|l\.l\.c\.?|inc\.?|incorporated|corp\.?|corporation|co\.?|company|ltd\.?|limited|plc|llp|lp|pllc|p\.c\.?|pc)\b/gi, "")
    .replace(/[,&]/g, " ")
    .trim();
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 50);
}

function dashify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

/**
 * Build up to ~10 likely homepage URLs from a business name. Tries the
 * raw name, the suffix-stripped variant, both slug + dash forms, on
 * .com, .net, and .io.
 */
export function candidateHomepages(businessName: string): string[] {
  const variants = new Set<string>();
  const raw = businessName.trim();
  const stripped = stripBusinessSuffix(raw);
  for (const name of [stripped, raw]) {
    if (!name) continue;
    const slug = slugify(name);
    const dashed = dashify(name);
    for (const host of [slug, dashed].filter(Boolean)) {
      variants.add(`https://${host}.com`);
      variants.add(`https://www.${host}.com`);
      variants.add(`https://${host}.net`);
      variants.add(`https://${host}.co`);
      variants.add(`https://${host}.io`);
    }
  }
  return Array.from(variants);
}

// ---------------------------------------------------------------------------
// 2. Sub-page discovery — fixed list + auto-discovered from homepage links
// ---------------------------------------------------------------------------

const COMMON_SUB_SLUGS = [
  "/about", "/about-us", "/who-we-are", "/our-story",
  "/contact", "/contact-us",
  "/team", "/our-team", "/staff", "/leadership", "/management",
  "/services", "/what-we-do", "/solutions",
  "/locations", "/offices", "/visit-us",
];

const SUB_SLUG_PATTERNS: ReadonlyArray<{ pattern: RegExp; kind: "about" | "contact" | "team" | "services" | "locations" }> = [
  { pattern: /(^|\/)(about|who-we-are|our-story|our-company)(\/|$)/i, kind: "about" },
  { pattern: /(^|\/)(contact|contact-us|reach-us|get-in-touch)(\/|$)/i, kind: "contact" },
  { pattern: /(^|\/)(team|our-team|staff|leadership|management|people)(\/|$)/i, kind: "team" },
  { pattern: /(^|\/)(services|what-we-do|solutions|offerings|capabilities)(\/|$)/i, kind: "services" },
  { pattern: /(^|\/)(locations|offices|visit-us|branches|find-us)(\/|$)/i, kind: "locations" },
];

function classifySlug(path: string): "about" | "contact" | "team" | "services" | "locations" | null {
  for (const { pattern, kind } of SUB_SLUG_PATTERNS) {
    if (pattern.test(path)) return kind;
  }
  return null;
}

/**
 * Pick up to `max` same-domain sub-URLs to crawl, classifying each by
 * slug pattern. Exported so the new seed-scrape module can reuse it
 * without duplicating the slug-classification logic.
 */
export function pickSubUrls(base: string, discoveredLinks: string[], max: number): Array<{ url: string; kind: "about" | "contact" | "team" | "services" | "locations" }> {
  const seen = new Set<string>();
  const out: Array<{ url: string; kind: "about" | "contact" | "team" | "services" | "locations" }> = [];

  // First: auto-discovered links that match a known pattern.
  for (const slug of discoveredLinks) {
    const kind = classifySlug(slug);
    if (!kind) continue;
    try {
      const full = new URL(slug, base).toString();
      if (seen.has(full)) continue;
      seen.add(full);
      out.push({ url: full, kind });
      if (out.length >= max) return out;
    } catch { /* ignore bad slugs */ }
  }

  // Fallback: try common slugs against the base.
  for (const slug of COMMON_SUB_SLUGS) {
    try {
      const full = new URL(slug, base).toString();
      if (seen.has(full)) continue;
      seen.add(full);
      const kind = classifySlug(slug);
      if (kind) out.push({ url: full, kind });
      if (out.length >= max) return out;
    } catch { /* ignore */ }
  }

  return out;
}

// ---------------------------------------------------------------------------
// 3. Regex extraction from plain text
// ---------------------------------------------------------------------------

const PHONE_RE = /(?:\+?1[\s.-]?)?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const LINKEDIN_RE = /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9_-]+/gi;
const GOOG_RE = /https?:\/\/(?:www\.)?google\.com\/maps\/place\/[^\s"'<>]+/gi;
const SEAT_HINT_RE = /\b(\d{1,4})\s*(?:\+|plus)?\s*(?:employees|staff|team members|professionals|associates|people)\b/gi;
const FOUNDED_RE = /\b(?:founded|established|since)\b[^.]{0,40}\b(19|20)\d{2}\b/gi;

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1")) return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return null;
}

function uniqueMatches(re: RegExp, text: string, limit = 10): string[] {
  re.lastIndex = 0;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) != null && out.size < limit) out.add(m[0]);
  return Array.from(out);
}

export type RegexHarvest = {
  phones: string[];
  emails: string[];
  linkedinUrls: string[];
  googleMapsUrls: string[];
  seatCountHints: number[];
  foundedYearHints: number[];
};

export function harvestFromText(text: string): RegexHarvest {
  const phonesRaw = uniqueMatches(PHONE_RE, text, 12);
  const phones = phonesRaw.map(normalizePhone).filter((p): p is string => p != null);
  const seatHints: number[] = [];
  SEAT_HINT_RE.lastIndex = 0;
  let sh: RegExpExecArray | null;
  while ((sh = SEAT_HINT_RE.exec(text)) != null && seatHints.length < 6) {
    const n = Number(sh[1]);
    if (Number.isFinite(n) && n > 0 && n < 50_000) seatHints.push(n);
  }
  const foundedHints: number[] = [];
  FOUNDED_RE.lastIndex = 0;
  let fh: RegExpExecArray | null;
  while ((fh = FOUNDED_RE.exec(text)) != null && foundedHints.length < 4) {
    const year = Number((fh[0].match(/\b(19|20)\d{2}\b/) ?? [])[0]);
    if (year >= 1900 && year <= new Date().getFullYear()) foundedHints.push(year);
  }
  return {
    phones: Array.from(new Set(phones)).slice(0, 6),
    emails: uniqueMatches(EMAIL_RE, text, 12)
      .filter((e) => !/@(sentry|wixpress|wix|cloudinary|google|facebook|gstatic|noreply|do-not-reply)\./i.test(e))
      .slice(0, 6),
    linkedinUrls: uniqueMatches(LINKEDIN_RE, text, 4),
    googleMapsUrls: uniqueMatches(GOOG_RE, text, 4),
    seatCountHints: seatHints,
    foundedYearHints: foundedHints,
  };
}

// ---------------------------------------------------------------------------
// 4. Claude inference — structured Lead fields from gathered signals
// ---------------------------------------------------------------------------

const INFER_PROMPT = `## Your job
You are an OSINT analyst helping a sales rep populate a Lead record.

INPUTS YOU WILL RECEIVE
- The rep's seed input (whatever they typed — usually a business name,
  maybe a city, address, or partial contact)
- STRUCTURED FACTS pulled from the company's website schema.org JSON-LD
  (this is the highest-confidence source — legal name, address, phone,
  employees, founder, social URLs that the company itself published).
  When a fact appears here, prefer it.
- REGEX HITS from scraped plain text — phones, emails, LinkedIn URLs,
  Google Maps URLs, "X employees" / "founded YYYY" hints.
- SCRAPED PAGES — title, meta description, plain text from homepage +
  /about + /contact + /team + /services + /locations.

WHAT TO RETURN
A single JSON object. Use null for fields you genuinely can't determine.
Do not invent contact info that doesn't appear in the scraped material.

{
  "businessName": "official legal or commonly-used name",
  "dbaName": "DBA / trade name if different from legal",
  "industry": "MEDICAL | LEGAL | FEDERAL_CONTRACTING | MANUFACTURING | HOSPITALITY | FINANCIAL_SERVICES | PROFESSIONAL_SERVICES | EDUCATION | NONPROFIT | OTHER",
  "subindustry": "more specific niche (CPA firm, ortho clinic, defense subcontractor)",
  "seatCount": <int — employees needing IT, null if unknown. Prefer JSON-LD numberOfEmployees; else use regex hints; else infer from team-page headcount or 'small / mid-size firm' wording>,
  "siteCount": <int — number of offices. Default 1 single-location. Count addresses on /locations page>,
  "addressStreet": "...",
  "addressCity": "...",
  "addressState": "two-letter state code",
  "addressZip": "...",
  "websiteUrl": "canonical https://...",
  "linkedinCompanyUrl": "https://www.linkedin.com/company/...",
  "googleBusinessUrl": "Google Maps place URL",
  "primaryContactName": "owner / founder / managing partner — pick the most senior named individual in the scraped material",
  "primaryContactTitle": "their title verbatim",
  "primaryContactEmail": "must come from scraped text or regex hits — do not invent",
  "primaryContactPhone": "must come from scraped text or regex hits — do not invent",
  "executiveSponsorName": "C-level decision maker if different from primary contact, else null",
  "executiveSponsorTitle": "...",
  "currentMspName": "if their site or job posts mention an IT vendor",

  "interestedServices": ["ServiceLine values they appear to NEED, drawn from: MANAGED_IT, CYBERSECURITY, VOIP, ACCESS_CONTROL, VIDEO, CABLING, AI_ADVISORY, NIST_ASSESSMENT, VCIO_RETAINER. Only include lines with at least one specific clue (e.g. 'we use 3CX phones' → VOIP). Do NOT default-include all 9."],
  "currentPhoneSystem": "if the site mentions a phone vendor / extension layout / 'call us at' indicates a system, otherwise null",
  "currentPhonePainPoint": "if a Glassdoor-style review, blog post, or careers page mentions phone friction, otherwise null",
  "currentAccessControl": "if the site mentions door access, badging, key cards, or 'mechanical keys' — otherwise null",
  "currentVideoSurveillance": "if the site mentions cameras, surveillance, or security imagery — otherwise null",
  "cablingStatus": "if the site mentions a recent move, build-out, new office, or 'expanding into [city]' — otherwise null",
  "expansionPlans": "free-text summary of growth signals: 'opening 3rd location Q3', '20% headcount growth this year'",
  "aiAdvisoryInterest": "if the site / blog / news mentions AI tools, Copilot, AI strategy, or 'we're exploring AI' — otherwise null",

  "narrative": "5-7 sentence plain-English brief on who they are, what they do, scale, locations, and the most relevant signals for a sales rep walking into a discovery call. Lead with the most concrete fact (e.g. '20-attorney litigation firm with two offices in Burbank and Glendale, founded 1998').",
  "gaps": ["concrete bullets describing what you couldn't determine that the rep should ask about — e.g. 'exact seat count not on site (estimated 12-15)', 'no executive sponsor named'"]
}

RULES
- industry MUST be one of the listed enum values. Default to OTHER only if no signal at all.
- When phone numbers appear multiple times, prefer the main / front-desk line over individual mobile numbers.
- For primaryContactName, prefer 'Owner', 'Founder', 'Principal', 'Managing Partner', 'CEO', 'President' in titles. If JSON-LD founder is present, use that.
- If you find a /locations page listing 3 addresses, set siteCount = 3.
- seatCount best-effort: JSON-LD numberOfEmployees first; regex 'X employees' hints; '15-attorney firm' = 15 + ~3 admin; otherwise null.
- If a state is only mentioned in a ZIP code, infer the state from the ZIP.
- interestedServices is the most important new field — only check a service when scraped material gives concrete evidence (e.g., team page lists 12 people → MANAGED_IT + VOIP; multi-location retailer → ACCESS_CONTROL + VIDEO; defense contractor → NIST_ASSESSMENT). Better to leave it empty than to over-check.`;

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
  interestedServices?: string[] | null;
  currentPhoneSystem?: string | null;
  currentPhonePainPoint?: string | null;
  currentAccessControl?: string | null;
  currentVideoSurveillance?: string | null;
  cablingStatus?: string | null;
  expansionPlans?: string | null;
  aiAdvisoryInterest?: string | null;
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
  const maxSubPages = opts.maxSubPages ?? 4;
  const maxCandidates = opts.maxCandidates ?? 8;

  const sourcesUsed: EnrichmentResult["sourcesUsed"] = [];
  const sourcesFailed: EnrichmentResult["sourcesFailed"] = [];
  const pages: Array<{ url: string; kind: EnrichmentResult["sourcesUsed"][number]["kind"]; text: string; jsonLd: unknown[]; metaTags: Record<string, string>; inDomainLinks: string[] }> = [];

  // ---------- 1. Find the homepage ----------
  let homepage: string | null = seed.websiteUrl?.trim() || null;

  async function tryPage(url: string, kind: EnrichmentResult["sourcesUsed"][number]["kind"]): Promise<boolean> {
    const r = await fetchPage(url);
    if (r.ok) {
      pages.push({
        url: r.finalUrl,
        kind,
        text: r.page.plainText,
        jsonLd: r.page.jsonLd,
        metaTags: r.page.metaTags,
        inDomainLinks: r.page.inDomainLinks,
      });
      sourcesUsed.push({ url: r.finalUrl, kind, bytes: r.bytes });
      return true;
    }
    sourcesFailed.push({ url, reason: r.reason });
    return false;
  }

  if (homepage) {
    // Rep provided URL — trust it, scrape.
    const ok = await tryPage(homepage, "homepage");
    if (!ok) homepage = null;
  }

  if (!homepage) {
    // Try candidate URLs by name heuristic.
    for (const c of candidateHomepages(seed.businessName).slice(0, maxCandidates)) {
      const ok = await tryPage(c, "candidate");
      if (ok) {
        homepage = pages[pages.length - 1]!.url;
        break;
      }
    }
  }

  if (!homepage) {
    // Final fallback: DDG search.
    const hit = await findHomepageBySearch(seed.businessName, {
      addressCity: seed.addressCity,
      addressState: seed.addressState,
    });
    if (hit) {
      const ok = await tryPage(hit.url, "ddg");
      if (ok) homepage = pages[pages.length - 1]!.url;
    }
  }

  // ---------- 2. Sub-page crawl ----------
  if (homepage) {
    const discovered = pages[0]!.inDomainLinks;
    const subs = pickSubUrls(homepage, discovered, maxSubPages);
    for (const { url, kind } of subs) {
      await tryPage(url, kind);
    }
  }

  // ---------- 3. Pull StructuredFacts across all pages ----------
  // Merge JSON-LD nodes from every page and run structuredFactsFrom once.
  const mergedFacts: StructuredFacts = (() => {
    const merged: StructuredFacts = {};
    for (const p of pages) {
      const f = structuredFactsFrom({
        title: "",
        metaTags: p.metaTags,
        plainText: p.text,
        jsonLd: p.jsonLd as never,
        inDomainLinks: [],
        imageAlts: [],
      });
      for (const k of Object.keys(f) as Array<keyof StructuredFacts>) {
        if (merged[k] == null && f[k] != null) merged[k] = f[k] as never;
      }
    }
    return merged;
  })();

  // ---------- 4. Regex harvest ----------
  const combined = pages.map((p) => p.text).join("\n\n").slice(0, 30_000);
  const harvest = harvestFromText(combined);

  // Merge phones/emails from JSON-LD into the harvest if missing.
  if (mergedFacts.telephone && !harvest.phones.includes(mergedFacts.telephone)) {
    const norm = normalizePhone(mergedFacts.telephone);
    if (norm) harvest.phones.unshift(norm);
  }
  if (mergedFacts.email && !harvest.emails.includes(mergedFacts.email)) {
    harvest.emails.unshift(mergedFacts.email);
  }

  // ---------- 5. Claude inference ----------
  let inferred: InferredFields = {};
  if (isAnthropicConfigured() && (combined.length > 100 || homepage || Object.keys(mergedFacts).length > 0)) {
    const seedBlock = [
      `Business name (rep input): ${seed.businessName}`,
      seed.websiteUrl ? `Website (rep input): ${seed.websiteUrl}` : null,
      seed.addressCity || seed.addressState
        ? `Address hint: ${[seed.addressStreet, seed.addressCity, seed.addressState, seed.addressZip].filter(Boolean).join(", ")}`
        : null,
      seed.primaryContactName ? `Contact (rep input): ${seed.primaryContactName}` : null,
    ].filter(Boolean).join("\n");

    const factsBlock = Object.keys(mergedFacts).length === 0
      ? "(no JSON-LD structured data found)"
      : JSON.stringify(mergedFacts, null, 2).slice(0, 4000);

    const regexBlock = [
      harvest.phones.length > 0 ? `Phones: ${harvest.phones.join(", ")}` : null,
      harvest.emails.length > 0 ? `Emails: ${harvest.emails.join(", ")}` : null,
      harvest.linkedinUrls.length > 0 ? `LinkedIn URLs: ${harvest.linkedinUrls.join(", ")}` : null,
      harvest.googleMapsUrls.length > 0 ? `Google Maps URLs: ${harvest.googleMapsUrls.join(", ")}` : null,
      harvest.seatCountHints.length > 0 ? `Seat hints (regex from text): ${harvest.seatCountHints.join(", ")}` : null,
      harvest.foundedYearHints.length > 0 ? `Founded year hints: ${harvest.foundedYearHints.join(", ")}` : null,
    ].filter(Boolean).join("\n");

    const scrapeBlock = pages
      .map((p) => `### ${p.kind.toUpperCase()} — ${p.url}\nTITLE: ${p.metaTags["og:title"] ?? ""}\nDESC: ${p.metaTags["description"] ?? p.metaTags["og:description"] ?? ""}\nTEXT: ${p.text.slice(0, 4000)}`)
      .join("\n\n---\n\n")
      .slice(0, 18_000);

    const user = `SEED INPUT\n${seedBlock}\n\nSTRUCTURED FACTS (JSON-LD)\n${factsBlock}\n\nREGEX HITS\n${regexBlock || "(none)"}\n\nSCRAPED PAGES\n${scrapeBlock || "(no pages scraped)"}`;
    try {
      const { text } = await claudeCompletion({
        system: INFER_PROMPT,
        user,
        responseHint: "Return ONLY the JSON object — no markdown, no commentary, your ENTIRE response is the JSON object.",
        maxTokens: 2500,
        budget: opts.userId
          ? { userId: opts.userId, feature: AiFeatureKind.RESEARCH_SUMMARY }
          : undefined,
      });
      const parsed = safeJsonParse(text);
      if (parsed && typeof parsed === "object") inferred = parsed as InferredFields;
    } catch (e) {
      console.error("[lead-enrich] claude inference failed:", (e as Error).message);
    }
  }

  // ---------- 6. Assemble per-field proposals ----------
  // Priority: seed > jsonld > regex > claude. Seed already lives in the
  // form; we only emit proposals where there's something to add.
  const fields: EnrichmentResult["fields"] = {};
  function set<K extends keyof EnrichmentResult["fields"]>(
    key: K,
    value: NonNullable<EnrichmentResult["fields"][K]>["value"],
    source: Source,
    confidence: number,
    sourceUrl?: string,
  ) {
    (fields as Record<string, EnrichedField<unknown>>)[key as string] = { value: value as never, source, confidence, sourceUrl };
  }

  // Website (only propose if we discovered or DDG-found it).
  if (homepage && (!seed.websiteUrl || seed.websiteUrl.trim() === "")) {
    const isDdg = pages[0]?.kind === "ddg";
    set("websiteUrl", homepage, isDdg ? "ddg" : "website", isDdg ? 0.85 : 0.95, homepage);
  }

  // JSON-LD facts (highest confidence).
  if (mergedFacts.legalName && mergedFacts.legalName.trim() !== seed.businessName.trim()) {
    set("businessName", mergedFacts.legalName, "jsonld", 0.9);
  }
  if (mergedFacts.dbaName) set("dbaName", mergedFacts.dbaName, "jsonld", 0.85);
  if (mergedFacts.streetAddress && !seed.addressStreet) set("addressStreet", mergedFacts.streetAddress, "jsonld", 0.9);
  if (mergedFacts.addressLocality && !seed.addressCity) set("addressCity", mergedFacts.addressLocality, "jsonld", 0.9);
  if (mergedFacts.addressRegion && !seed.addressState) set("addressState", mergedFacts.addressRegion, "jsonld", 0.9);
  if (mergedFacts.postalCode && !seed.addressZip) set("addressZip", mergedFacts.postalCode, "jsonld", 0.9);
  if (mergedFacts.telephone && !seed.primaryContactPhone) {
    const norm = normalizePhone(mergedFacts.telephone) ?? mergedFacts.telephone;
    set("primaryContactPhone", norm, "jsonld", 0.85);
  }
  if (mergedFacts.email && !seed.primaryContactEmail) set("primaryContactEmail", mergedFacts.email, "jsonld", 0.85);
  if (mergedFacts.numberOfEmployees && mergedFacts.numberOfEmployees > 0) {
    set("seatCount", mergedFacts.numberOfEmployees, "jsonld", 0.85);
  }
  if (mergedFacts.ownerOrFounderName && !seed.primaryContactName) {
    set("primaryContactName", mergedFacts.ownerOrFounderName, "jsonld", 0.85);
    if (mergedFacts.ownerOrFounderTitle) set("primaryContactTitle", mergedFacts.ownerOrFounderTitle, "jsonld", 0.85);
  }
  if (mergedFacts.sameAs) {
    const li = mergedFacts.sameAs.find((u) => /linkedin\.com\/(company|in)\//i.test(u));
    if (li) set("linkedinCompanyUrl", li, "jsonld", 0.9);
    const g = mergedFacts.sameAs.find((u) => /google\.com\/maps\//i.test(u));
    if (g) set("googleBusinessUrl", g, "jsonld", 0.9);
  }

  // Regex hits — only if the JSON-LD step didn't already cover them.
  if (!fields.primaryContactPhone) {
    const firstPhone = harvest.phones[0];
    if (firstPhone && !seed.primaryContactPhone) set("primaryContactPhone", firstPhone, "regex", 0.65);
  }
  if (!fields.primaryContactEmail) {
    const firstEmail = harvest.emails[0];
    if (firstEmail && !seed.primaryContactEmail) set("primaryContactEmail", firstEmail, "regex", 0.65);
  }
  if (!fields.linkedinCompanyUrl) {
    const li = harvest.linkedinUrls[0];
    if (li) set("linkedinCompanyUrl", li, "regex", 0.75);
  }
  if (!fields.googleBusinessUrl) {
    const g = harvest.googleMapsUrls[0];
    if (g) set("googleBusinessUrl", g, "regex", 0.75);
  }
  if (!fields.seatCount && harvest.seatCountHints.length > 0) {
    set("seatCount", harvest.seatCountHints[0]!, "regex", 0.55);
  }

  // Claude inferred fields (lowest confidence, but covers what JSON-LD misses).
  function maybeStr<K extends keyof EnrichmentResult["fields"]>(
    key: K,
    inferredVal: string | null | undefined,
    seedVal: string | null | undefined,
    conf = 0.65,
  ) {
    if (!fields[key] && !seedVal && inferredVal && inferredVal.trim()) {
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
  maybeStr("subindustry", inferred.subindustry, null, 0.65);

  // v3.3.17 — multi-service intake proposals from Claude inference
  maybeStr("currentPhoneSystem", inferred.currentPhoneSystem, null, 0.55);
  maybeStr("currentPhonePainPoint", inferred.currentPhonePainPoint, null, 0.5);
  maybeStr("currentAccessControl", inferred.currentAccessControl, null, 0.5);
  maybeStr("currentVideoSurveillance", inferred.currentVideoSurveillance, null, 0.5);
  maybeStr("cablingStatus", inferred.cablingStatus, null, 0.55);
  maybeStr("expansionPlans", inferred.expansionPlans, null, 0.55);
  maybeStr("aiAdvisoryInterest", inferred.aiAdvisoryInterest, null, 0.55);

  // interestedServices array — validate values against the enum.
  if (Array.isArray(inferred.interestedServices) && inferred.interestedServices.length > 0) {
    const allowed = new Set(Object.values(ServiceLine) as string[]);
    const cleaned: ServiceLine[] = [];
    for (const s of inferred.interestedServices) {
      if (typeof s === "string" && allowed.has(s) && !cleaned.includes(s as ServiceLine)) {
        cleaned.push(s as ServiceLine);
      }
    }
    if (cleaned.length > 0) {
      set("interestedServices", cleaned, "claude", 0.6);
    }
  }

  // Industry — only set if Claude's value matches our enum.
  if (inferred.industry && (Object.values(Industry) as string[]).includes(inferred.industry)) {
    set("industry", inferred.industry as Industry, "claude", 0.75);
  }
  // Numerics
  if (!fields.seatCount && typeof inferred.seatCount === "number" && inferred.seatCount > 0) {
    set("seatCount", Math.round(inferred.seatCount), "claude", 0.55);
  }
  if (typeof inferred.siteCount === "number" && inferred.siteCount > 0) {
    set("siteCount", Math.round(inferred.siteCount), "claude", 0.7);
  }

  // Business name — propose only if Claude found a more canonical form
  // AND JSON-LD didn't already propose one.
  if (!fields.businessName && inferred.businessName && inferred.businessName.trim() && inferred.businessName.trim() !== seed.businessName.trim()) {
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

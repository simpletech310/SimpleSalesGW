/**
 * v3.3.28 — Seed scrape: deterministic OSINT first-pass.
 *
 * Pulled out of `enrich.ts` so both `enrichLead()` (lead-create form)
 * AND the new agentic research loop (`agent.ts`) can call it as turn 0.
 *
 * The flow is unchanged from v3.3.17:
 *   1. Discover homepage (rep URL → candidate URLs → DDG search).
 *   2. Crawl up to N same-domain sub-pages (/about, /contact, /team,
 *      /services, /locations) by classifying links discovered on the
 *      homepage; fall back to a fixed list of common slugs.
 *   3. Merge JSON-LD schema.org facts across all pages (highest
 *      confidence — usually copy-through).
 *   4. Regex-harvest phones, emails, LinkedIn/Google Maps URLs,
 *      seat-count and founded-year hints.
 *
 * Zero Claude tokens spent here. The agent loop sees this output as
 * its "INITIAL FINDINGS" block before deciding what to look up next.
 */

import { fetchPage } from "@/lib/scrape/fetch-page";
import { structuredFactsFrom, type StructuredFacts } from "@/lib/scrape/extract";
import { findHomepageBySearch } from "@/lib/scrape/search";
import {
  candidateHomepages,
  harvestFromText,
  pickSubUrls,
  type RegexHarvest,
} from "@/lib/lead-enrich/enrich";

export type SeedScrapeInput = {
  businessName: string;
  websiteUrl?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
};

export type SeedPageKind =
  | "homepage"
  | "candidate"
  | "ddg"
  | "about"
  | "contact"
  | "team"
  | "services"
  | "locations";

export type SeedPage = {
  url: string;
  kind: SeedPageKind;
  text: string;
  jsonLd: unknown[];
  metaTags: Record<string, string>;
  inDomainLinks: string[];
  bytes: number;
};

export type SeedScrapeResult = {
  /** First page is always the homepage if one was found. */
  pages: SeedPage[];
  /** Merged JSON-LD facts from every page (first-wins). */
  structuredFacts: StructuredFacts;
  /** Regex-harvested phones, emails, social URLs, seat/year hints. */
  regexHits: RegexHarvest;
  /** Final canonical homepage URL (may differ from rep input after redirect). */
  homepage: string | null;
  /** Per-page success log for telemetry. */
  sourcesUsed: Array<{ url: string; kind: SeedPageKind; bytes: number }>;
  /** Per-URL failure log for the toast / artifact list. */
  sourcesFailed: Array<{ url: string; reason: string }>;
  /** First 30KB of concatenated plainText across all pages (for downstream LLM). */
  combinedText: string;
};

export type SeedScrapeOpts = {
  maxCandidates?: number;
  maxSubPages?: number;
};

export async function seedScrape(
  seed: SeedScrapeInput,
  opts: SeedScrapeOpts = {},
): Promise<SeedScrapeResult> {
  const maxCandidates = opts.maxCandidates ?? 8;
  const maxSubPages = opts.maxSubPages ?? 4;

  const pages: SeedPage[] = [];
  const sourcesUsed: SeedScrapeResult["sourcesUsed"] = [];
  const sourcesFailed: SeedScrapeResult["sourcesFailed"] = [];

  async function tryPage(url: string, kind: SeedPageKind): Promise<boolean> {
    const r = await fetchPage(url);
    if (r.ok) {
      pages.push({
        url: r.finalUrl,
        kind,
        text: r.page.plainText,
        jsonLd: r.page.jsonLd,
        metaTags: r.page.metaTags,
        inDomainLinks: r.page.inDomainLinks,
        bytes: r.bytes,
      });
      sourcesUsed.push({ url: r.finalUrl, kind, bytes: r.bytes });
      return true;
    }
    sourcesFailed.push({ url, reason: r.reason });
    return false;
  }

  // --- 1. Homepage ---
  let homepage: string | null = seed.websiteUrl?.trim() || null;
  if (homepage) {
    const ok = await tryPage(homepage, "homepage");
    if (!ok) homepage = null;
  }
  if (!homepage) {
    for (const c of candidateHomepages(seed.businessName).slice(0, maxCandidates)) {
      const ok = await tryPage(c, "candidate");
      if (ok) {
        homepage = pages[pages.length - 1]!.url;
        break;
      }
    }
  }
  if (!homepage) {
    const hit = await findHomepageBySearch(seed.businessName, {
      addressCity: seed.addressCity,
      addressState: seed.addressState,
    });
    if (hit) {
      const ok = await tryPage(hit.url, "ddg");
      if (ok) homepage = pages[pages.length - 1]!.url;
    }
  }

  // --- 2. Sub-page crawl ---
  if (homepage) {
    const discovered = pages[0]!.inDomainLinks;
    const subs = pickSubUrls(homepage, discovered, maxSubPages);
    for (const { url, kind } of subs) {
      await tryPage(url, kind);
    }
  }

  // --- 3. Merge structured facts ---
  const structuredFacts: StructuredFacts = (() => {
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

  // --- 4. Regex harvest ---
  const combinedText = pages.map((p) => p.text).join("\n\n").slice(0, 30_000);
  const regexHits = harvestFromText(combinedText);

  return {
    pages,
    structuredFacts,
    regexHits,
    homepage,
    sourcesUsed,
    sourcesFailed,
    combinedText,
  };
}

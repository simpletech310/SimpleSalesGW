/**
 * HTML → structured signal extractor.
 *
 * v3.3.17 — substantially upgraded. We now harvest:
 *   - title
 *   - meta tags (description, og:*, twitter:*, etc.)
 *   - plainText (denoised body for AI context)
 *   - JSON-LD structured data (schema.org Organization / LocalBusiness /
 *     Person — gives us reliable legal name, address, phone, employees,
 *     founder, social links without guessing)
 *   - same-domain link slugs (so the enrich crawler can auto-discover
 *     /staff /services /our-story etc. without a hard-coded list)
 *   - image alt text on hero-area images (sometimes carries seat count,
 *     founder name, or branch list)
 *
 * Everything is parsed once + cached on the result so downstream code
 * doesn't have to re-tokenize the HTML.
 */

import { parse } from "node-html-parser";

export type JsonLdNode = Record<string, unknown>;

export type ExtractedPage = {
  title: string;
  metaTags: Record<string, string>;
  plainText: string;
  jsonLd: JsonLdNode[];
  /** Slugs to other in-domain pages found in nav / footer links. */
  inDomainLinks: string[];
  /** First ~12 image alt texts (often carries team/site names). */
  imageAlts: string[];
};

function safeJson(s: string): unknown | null {
  try { return JSON.parse(s); } catch { return null; }
}

/** Recursively flatten JSON-LD @graph entries into a flat array of nodes. */
function flattenJsonLd(value: unknown): JsonLdNode[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const graph = obj["@graph"];
    if (graph) return flattenJsonLd(graph);
    return [obj];
  }
  return [];
}

export function extractFromHtml(html: string, maxTextChars = 12000): ExtractedPage {
  // Parse once with script/style/noscript preserved so we can pull JSON-LD,
  // then strip them before extracting plain text.
  const root = parse(html, {
    blockTextElements: { script: false, noscript: false, style: false, pre: true },
  });

  // ---- title ----
  const title = (root.querySelector("title")?.text ?? "").trim().slice(0, 300);

  // ---- meta tags ----
  const metaTags: Record<string, string> = {};
  for (const m of root.querySelectorAll("meta")) {
    const name = m.getAttribute("name") || m.getAttribute("property") || m.getAttribute("itemprop") || "";
    const content = m.getAttribute("content");
    if (name && content && metaTags[name] === undefined) {
      metaTags[name] = content.slice(0, 500);
    }
  }

  // ---- JSON-LD structured data ----
  const jsonLd: JsonLdNode[] = [];
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    const raw = s.text;
    if (!raw || raw.length > 64_000) continue;
    const parsed = safeJson(raw);
    if (parsed) jsonLd.push(...flattenJsonLd(parsed));
  }

  // ---- image alts ----
  const imageAlts: string[] = [];
  for (const img of root.querySelectorAll("img")) {
    const alt = (img.getAttribute("alt") || "").trim();
    if (alt && alt.length > 2 && alt.length < 240) imageAlts.push(alt);
    if (imageAlts.length >= 12) break;
  }

  // ---- in-domain link slugs (for sub-page auto-discovery) ----
  const inDomainLinks: string[] = [];
  const seenSlugs = new Set<string>();
  for (const a of root.querySelectorAll("a")) {
    const href = a.getAttribute("href") || "";
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) continue;
    // Same-origin paths only — bare slugs or relative paths
    if (/^https?:\/\//i.test(href)) continue;
    // Normalize: drop query/hash, lowercase
    const slug = href.split(/[?#]/)[0]!.toLowerCase().trim();
    if (!slug || slug === "/" || slug.length > 80) continue;
    if (seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    inDomainLinks.push(slug);
    if (inDomainLinks.length >= 60) break;
  }

  // ---- denoise + plain text ----
  root.querySelectorAll("script, style, noscript, svg, iframe, link").forEach((n) => n.remove());
  // Heuristically prefer the main content area when present.
  const main = root.querySelector("main") ?? root.querySelector('[role="main"]');
  const textNode = main ?? root;
  const text = textNode.text.replace(/\s+/g, " ").trim().slice(0, maxTextChars);

  return { title, metaTags, plainText: text, jsonLd, inDomainLinks, imageAlts };
}

/**
 * Pull a flat shape we can pass to AI directly: org name, address bits,
 * phone, email, employees, social URLs, founder/CEO — derived from
 * JSON-LD when present, then meta tags as fallback.
 */
export type StructuredFacts = {
  legalName?: string;
  dbaName?: string;
  description?: string;
  url?: string;
  telephone?: string;
  email?: string;
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  numberOfEmployees?: number;
  foundingDate?: string;
  sameAs?: string[];
  ownerOrFounderName?: string;
  ownerOrFounderTitle?: string;
};

function pickString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

function pickNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const m = value.match(/\d+/);
    if (m) return Number(m[0]);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.value != null) return pickNumber(obj.value);
    if (obj.minValue != null) return pickNumber(obj.minValue);
  }
  return undefined;
}

export function structuredFactsFrom(page: ExtractedPage): StructuredFacts {
  const out: StructuredFacts = {};

  // Walk JSON-LD nodes — prioritize Organization / LocalBusiness
  for (const node of page.jsonLd) {
    const t = node["@type"];
    const types = Array.isArray(t) ? t.map(String) : [String(t ?? "")];
    const isOrg = types.some((x) => /Organization|LocalBusiness|Corporation|Company/i.test(x));
    const isPerson = types.some((x) => /Person/i.test(x));
    if (isOrg) {
      out.legalName ??= pickString(node.legalName, node.name);
      out.dbaName ??= pickString(node.alternateName);
      out.description ??= pickString(node.description);
      out.url ??= pickString(node.url);
      out.telephone ??= pickString(node.telephone);
      out.email ??= pickString(node.email);
      const addr = node.address as Record<string, unknown> | undefined;
      if (addr) {
        out.streetAddress ??= pickString(addr.streetAddress);
        out.addressLocality ??= pickString(addr.addressLocality);
        out.addressRegion ??= pickString(addr.addressRegion);
        out.postalCode ??= pickString(addr.postalCode);
      }
      out.numberOfEmployees ??= pickNumber(node.numberOfEmployees);
      out.foundingDate ??= pickString(node.foundingDate);
      if (Array.isArray(node.sameAs)) {
        out.sameAs = (node.sameAs as unknown[]).filter((s): s is string => typeof s === "string");
      }
      const founder = node.founder as Record<string, unknown> | Record<string, unknown>[] | undefined;
      if (founder) {
        const first = Array.isArray(founder) ? founder[0] : founder;
        if (first) {
          out.ownerOrFounderName ??= pickString(first.name);
          out.ownerOrFounderTitle ??= pickString(first.jobTitle) ?? "Founder";
        }
      }
    } else if (isPerson) {
      const job = pickString(node.jobTitle);
      if (job && /owner|founder|ceo|president|principal|managing partner/i.test(job)) {
        out.ownerOrFounderName ??= pickString(node.name);
        out.ownerOrFounderTitle ??= job;
      }
    }
  }

  // OpenGraph + meta tag fallbacks
  if (!out.description) out.description = pickString(page.metaTags["og:description"], page.metaTags["description"], page.metaTags["twitter:description"]);
  if (!out.legalName) out.legalName = pickString(page.metaTags["og:site_name"]);
  if (!out.url) out.url = pickString(page.metaTags["og:url"]);

  return out;
}

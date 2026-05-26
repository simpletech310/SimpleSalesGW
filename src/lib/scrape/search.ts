/**
 * v3.3.17 — DuckDuckGo HTML search fallback.
 *
 * When the rep gives us only a business name and the candidate-URL
 * guesses (businessname.com, .net, dashed) all fail, hit DDG's HTML
 * endpoint which returns clean static HTML (no JS required, no auth)
 * and pick the most-likely company website from the result list.
 *
 * DDG is chosen because:
 *   - No API key needed
 *   - Returns clean HTML (Google + Bing both require JS or paid APIs)
 *   - Lenient on bots when called with a normal User-Agent
 *
 * If DDG ever changes / blocks us, this gracefully returns null and
 * the rep falls back to the manual flow.
 */

import { parse } from "node-html-parser";

const DDG_URL = "https://duckduckgo.com/html/";

// Domains that look like directories / aggregators / social, NOT the company's site.
const DIRECTORY_BLOCKLIST = [
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "yelp.com",
  "yellowpages.com",
  "bbb.org",
  "manta.com",
  "dnb.com",
  "zoominfo.com",
  "crunchbase.com",
  "rocketreach.co",
  "indeed.com",
  "glassdoor.com",
  "google.com",
  "maps.google.com",
  "mapquest.com",
  "tripadvisor.com",
  "wikipedia.org",
  "pinterest.com",
  "tiktok.com",
];

export type SearchResult = {
  url: string;
  title: string;
  snippet: string;
};

function isDirectoryDomain(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return DIRECTORY_BLOCKLIST.some((d) => h === d || h.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/**
 * Run a DDG HTML search. Returns up to 8 cleaned results, with directory
 * / social / aggregator domains filtered out.
 */
export async function searchDuckDuckGo(query: string, { take = 8 }: { take?: number } = {}): Promise<SearchResult[]> {
  const url = `${DDG_URL}?q=${encodeURIComponent(query)}`;
  // DDG needs a normal browser UA. We fetch raw HTML here because the
  // standard scrape pipeline strips out the SERP <a class="result__a">
  // anchors during the denoise step.
  const raw = await fetchRawHtml(url);
  if (!raw) return [];

  const tree = parse(raw);
  const results: SearchResult[] = [];

  // DDG's HTML layout uses .result blocks with a__result__a link.
  for (const block of tree.querySelectorAll(".result")) {
    const a = block.querySelector("a.result__a");
    if (!a) continue;
    let href = a.getAttribute("href") || "";
    // Decode DDG's redirect /l/?uddg=<encoded>&rut=...
    if (href.startsWith("//duckduckgo.com/l/") || href.startsWith("/l/")) {
      const m = href.match(/[?&]uddg=([^&]+)/);
      if (m) {
        try { href = decodeURIComponent(m[1]!); } catch { /* keep original */ }
      }
    }
    if (!/^https?:\/\//i.test(href)) continue;
    if (isDirectoryDomain(href)) continue;
    const titleText = a.text.trim().slice(0, 200);
    const snippetEl = block.querySelector(".result__snippet");
    const snippet = (snippetEl?.text ?? "").trim().slice(0, 300);
    results.push({ url: href, title: titleText, snippet });
    if (results.length >= take) break;
  }

  return results;
}

/**
 * Raw-HTML fetch helper (text only, ignoring our normal extract pipeline).
 * Used by DDG search to get the result list before passing each URL
 * back through the regular scrape pipeline.
 */
async function fetchRawHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const ctype = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!ctype.includes("text/html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Given a business name (+ optional city/state), try to find the
 * company's homepage URL. Returns null when we can't find anything
 * confident.
 */
export async function findHomepageBySearch(
  businessName: string,
  hints?: { addressCity?: string | null; addressState?: string | null },
): Promise<{ url: string; title: string; snippet: string } | null> {
  const qParts = [`"${businessName}"`];
  if (hints?.addressCity) qParts.push(hints.addressCity);
  if (hints?.addressState) qParts.push(hints.addressState);
  // Bias toward official-site by adding "official" + "site:" exclusions
  // is too aggressive — just rely on the directory blocklist + first
  // non-blocked hit.
  const q = qParts.join(" ");
  const hits = await searchDuckDuckGo(q, { take: 6 });
  if (hits.length === 0) return null;
  // Heuristic: first hit whose hostname doesn't include the word
  // "directory" or the business name as a path segment of a directory.
  const top = hits.find((h) => !/(directory|listing|review)/i.test(h.url)) ?? hits[0]!;
  return top;
}

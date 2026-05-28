/**
 * v3.3.28 — SEC EDGAR company search.
 *
 * Free public JSON endpoint:
 *   https://efts.sec.gov/LATEST/search-index?q=...&forms=10-K
 * plus the company tickers map:
 *   https://www.sec.gov/files/company_tickers.json
 *
 * Returns the company's CIK + most recent 10-K url + a best-effort
 * revenue band (parsed from the search index hit's "company" facet).
 * For a deeper dive on financials, the agent can fetch_url the 10-K.
 *
 * SEC requires a User-Agent that identifies the requester per their
 * fair-access policy. We set one.
 */

const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SEC_SEARCH_URL = "https://efts.sec.gov/LATEST/search-index";
const SEC_UA =
  "Gateway TelNet Research Agent (commonground.notify@gmail.com)";
const REQUEST_TIMEOUT_MS = 10_000;

export type SecLookupResult =
  | {
      ok: true;
      cik: string;
      ticker: string | null;
      legalName: string;
      latest10kUrl: string | null;
      latest10kDate: string | null;
      raw: unknown;
    }
  | { ok: false; reason: string };

let tickerCache: Map<string, { cik: string; ticker: string; title: string }> | null = null;
let tickerCacheAt = 0;
const TICKER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function loadTickers(): Promise<Map<string, { cik: string; ticker: string; title: string }>> {
  if (tickerCache && Date.now() - tickerCacheAt < TICKER_CACHE_TTL_MS) {
    return tickerCache;
  }
  const res = await fetch(SEC_TICKERS_URL, {
    headers: { "User-Agent": SEC_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    // Fall through with empty cache — caller will get no_results.
    tickerCache = new Map();
    tickerCacheAt = Date.now();
    return tickerCache;
  }
  // Format: { "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." }, ... }
  const data = (await res.json()) as Record<
    string,
    { cik_str: number | string; ticker: string; title: string }
  >;
  const map = new Map<string, { cik: string; ticker: string; title: string }>();
  for (const v of Object.values(data ?? {})) {
    const cik = String(v.cik_str).padStart(10, "0");
    map.set(v.title.toLowerCase(), { cik, ticker: v.ticker, title: v.title });
    map.set(v.ticker.toLowerCase(), { cik, ticker: v.ticker, title: v.title });
  }
  tickerCache = map;
  tickerCacheAt = Date.now();
  return map;
}

export async function lookupSecFiler(opts: {
  nameOrTicker: string;
}): Promise<SecLookupResult> {
  const q = opts.nameOrTicker.trim();
  if (!q) return { ok: false, reason: "missing_query" };

  let tickers: Map<string, { cik: string; ticker: string; title: string }>;
  try {
    tickers = await loadTickers();
  } catch (err) {
    return { ok: false, reason: `tickers_fetch_failed: ${(err as Error).message}` };
  }

  // Exact match by ticker, then by title (case-insensitive). Then a
  // contains-match across titles.
  const lowered = q.toLowerCase();
  let hit = tickers.get(lowered);
  if (!hit) {
    for (const [key, val] of tickers.entries()) {
      if (key.includes(lowered)) {
        hit = val;
        break;
      }
    }
  }
  if (!hit) return { ok: false, reason: "no_matching_filer" };

  // Pull the most recent 10-K URL from EDGAR's search index.
  let latest10kUrl: string | null = null;
  let latest10kDate: string | null = null;
  try {
    const u = new URL(SEC_SEARCH_URL);
    u.searchParams.set("q", `"${hit.title}"`);
    u.searchParams.set("forms", "10-K");
    u.searchParams.set("dateRange", "custom");
    const sres = await fetch(u.toString(), {
      headers: { "User-Agent": SEC_UA, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (sres.ok) {
      const sdata = (await sres.json()) as {
        hits?: { hits?: Array<{ _source?: { adsh?: string; file_date?: string } }> };
      };
      const first = sdata.hits?.hits?.[0]?._source;
      if (first?.adsh) {
        const accession = first.adsh.replace(/-/g, "");
        latest10kUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${hit.cik}&type=10-K&dateb=&owner=include&count=10`;
        latest10kDate = first.file_date ?? null;
        // Direct accession URL alternative:
        latest10kUrl = `https://www.sec.gov/Archives/edgar/data/${Number(hit.cik)}/${accession}`;
      }
    }
  } catch {
    // Non-fatal — return without the 10-K url
  }

  return {
    ok: true,
    cik: hit.cik,
    ticker: hit.ticker,
    legalName: hit.title,
    latest10kUrl,
    latest10kDate,
    raw: hit,
  };
}

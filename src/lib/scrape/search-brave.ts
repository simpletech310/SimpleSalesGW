/**
 * v3.3.28 — Brave Search API client.
 *
 * Used as the second-priority search provider behind Tavily. Brave
 * gives 2000 free queries/mo on the "Free AI" plan (https://brave.com/search/api/).
 *
 * No-op (returns null) when BRAVE_SEARCH_API_KEY is absent — the
 * multi-search façade then falls through to DuckDuckGo.
 */

import { env } from "@/lib/env";
import type { SearchResult } from "@/lib/scrape/search";

const BRAVE_URL = "https://api.search.brave.com/res/v1/web/search";
const BRAVE_TIMEOUT_MS = 8_000;

type BraveApiResult = {
  title?: string;
  url?: string;
  description?: string;
};

type BraveApiResponse = {
  web?: { results?: BraveApiResult[] };
};

export type BraveSearchOpts = {
  /** 1-20, default 6. */
  count?: number;
  /** "us", "gb", etc. Default "us". */
  country?: string;
};

export async function searchBrave(
  query: string,
  opts: BraveSearchOpts = {},
): Promise<SearchResult[] | null> {
  const key = env().BRAVE_SEARCH_API_KEY;
  if (!key) return null;

  try {
    const url = new URL(BRAVE_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(Math.max(1, Math.min(20, opts.count ?? 6))));
    url.searchParams.set("country", opts.country ?? "us");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": key,
      },
      signal: AbortSignal.timeout(BRAVE_TIMEOUT_MS),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[brave] search returned http_${res.status}`);
      return null;
    }
    const data = (await res.json()) as BraveApiResponse;
    const out: SearchResult[] = [];
    for (const r of data.web?.results ?? []) {
      if (!r.url || !/^https?:\/\//i.test(r.url)) continue;
      out.push({
        url: r.url,
        title: (r.title ?? "").slice(0, 200),
        snippet: (r.description ?? "").slice(0, 500),
      });
    }
    return out;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[brave] search failed:", (err as Error).message);
    return null;
  }
}

export function isBraveConfigured(): boolean {
  return Boolean(env().BRAVE_SEARCH_API_KEY);
}

/**
 * v3.3.28 — Tavily Search client.
 *
 * Tavily is purpose-built for LLM grounding: results are concise,
 * deduplicated, and include a snippet that's already extracted from
 * the page (no separate fetch needed for a first-pass read). Free
 * tier is 1000 queries/mo which comfortably covers a small sales team.
 *
 * https://docs.tavily.com/docs/rest-api/api-reference
 *
 * No-op (returns null) when TAVILY_API_KEY is absent — the multi-search
 * façade then falls through to Brave / DuckDuckGo.
 */

import { env } from "@/lib/env";
import type { SearchResult } from "@/lib/scrape/search";

const TAVILY_URL = "https://api.tavily.com/search";
const TAVILY_TIMEOUT_MS = 8_000;

type TavilyApiResult = {
  title?: string;
  url?: string;
  content?: string;
};

type TavilyApiResponse = {
  results?: TavilyApiResult[];
  // Tavily can also return answer/raw_content/images but we ignore those
  // — `content` is the snippet we want for a research-loop tool call.
};

export type TavilySearchOpts = {
  /** 1-10, default 6. Tavily caps at 10 per query. */
  maxResults?: number;
  /** "basic" (cheap) or "advanced" (deeper crawl, slower). Default basic. */
  searchDepth?: "basic" | "advanced";
  /** Restrict to recent results (e.g. "month" / "week"). Omit for all-time. */
  topic?: "general" | "news";
};

export async function searchTavily(
  query: string,
  opts: TavilySearchOpts = {},
): Promise<SearchResult[] | null> {
  const key = env().TAVILY_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: Math.max(1, Math.min(10, opts.maxResults ?? 6)),
        search_depth: opts.searchDepth ?? "basic",
        topic: opts.topic ?? "general",
      }),
      signal: AbortSignal.timeout(TAVILY_TIMEOUT_MS),
    });
    if (!res.ok) {
      // Tavily returns 429 when the monthly quota is exhausted. We log a
      // warning so the operator notices, then return null so the façade
      // falls through to Brave / DDG.
      // eslint-disable-next-line no-console
      console.warn(`[tavily] search returned http_${res.status}`);
      return null;
    }
    const data = (await res.json()) as TavilyApiResponse;
    const out: SearchResult[] = [];
    for (const r of data.results ?? []) {
      if (!r.url || !/^https?:\/\//i.test(r.url)) continue;
      out.push({
        url: r.url,
        title: (r.title ?? "").slice(0, 200),
        snippet: (r.content ?? "").slice(0, 500),
      });
    }
    return out;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[tavily] search failed:", (err as Error).message);
    return null;
  }
}

export function isTavilyConfigured(): boolean {
  return Boolean(env().TAVILY_API_KEY);
}

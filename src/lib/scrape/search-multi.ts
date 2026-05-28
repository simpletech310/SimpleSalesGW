/**
 * v3.3.28 — Multi-provider web search façade.
 *
 * One function: `webSearch(query)`. Tries providers in priority order
 * (Tavily → Brave → DuckDuckGo) and returns the first that produces
 * any results. Providers without an API key are skipped silently.
 *
 * The agentic research loop's `web_search` tool calls this. Reps never
 * see which provider answered; the only thing that matters is that
 * SOMETHING comes back so Claude can reason over it.
 */

import { searchTavily } from "@/lib/scrape/search-tavily";
import { searchBrave } from "@/lib/scrape/search-brave";
import { searchDuckDuckGo, type SearchResult } from "@/lib/scrape/search";

export type WebSearchProvider = "tavily" | "brave" | "duckduckgo" | "none";

export type WebSearchResponse = {
  provider: WebSearchProvider;
  results: SearchResult[];
  query: string;
};

export type WebSearchOpts = {
  /** Max results to ask for. Each provider clamps to its own ceiling. */
  maxResults?: number;
  /** Bias toward fresh news vs general web. Only Tavily honors this today. */
  topic?: "general" | "news";
};

export async function webSearch(
  query: string,
  opts: WebSearchOpts = {},
): Promise<WebSearchResponse> {
  const max = Math.max(1, Math.min(10, opts.maxResults ?? 6));

  // 1. Tavily — LLM-grounded, snippet-rich, 1000 free/mo.
  const tavily = await searchTavily(query, { maxResults: max, topic: opts.topic });
  if (tavily && tavily.length > 0) {
    return { provider: "tavily", results: tavily, query };
  }

  // 2. Brave — 2000 free/mo, decent quality.
  const brave = await searchBrave(query, { count: max });
  if (brave && brave.length > 0) {
    return { provider: "brave", results: brave, query };
  }

  // 3. DuckDuckGo HTML — unlimited but flakier; no key required.
  const ddg = await searchDuckDuckGo(query, { take: max });
  if (ddg.length > 0) {
    return { provider: "duckduckgo", results: ddg, query };
  }

  return { provider: "none", results: [], query };
}

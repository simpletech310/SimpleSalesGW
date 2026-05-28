/**
 * v3.3.28 — Tool registry for the agentic OSINT research loop.
 *
 * Each tool is a self-contained {name, description, inputSchema, handler}.
 * The handler is wrapped with `withArtifact` which automatically writes a
 * ResearchArtifact row for every invocation — so the rep's Audit + the
 * Research tab's Artifacts list shows exactly what the agent did.
 *
 * Tools are filtered + reordered per-call by `selectToolsFor(lead)` based
 * on the lead's industry. Earlier tools are weighted higher by Claude,
 * so industry-specific lookups go first when applicable.
 */

import { ResearchArtifactType, Industry } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ClaudeToolSpec, ClaudeToolResult, ClaudeToolCall } from "@/lib/ai/anthropic";
import { fetchPage } from "@/lib/scrape/fetch-page";
import { webSearch } from "@/lib/scrape/search-multi";
import { harvestFromText } from "@/lib/lead-enrich/enrich";
import { env } from "@/lib/env";

// ---------------------------------------------------------------------------
// Registry types
// ---------------------------------------------------------------------------

export type ToolContext = {
  leadId: string;
  userId?: string;
};

export type ToolHandlerResult = {
  /** Stringified content the model sees as the tool's output. */
  content: string;
  /** Structured payload persisted in the ResearchArtifact row. */
  payload: Record<string, unknown>;
  /** Where the data came from, for the artifact list / "Edit" link UI. */
  sourceUrl?: string;
  /** Set true if the tool soft-failed (e.g. quota exhausted, http_500).
   *  The model sees `is_error: true` so it can route around. */
  isError?: boolean;
};

export type ToolDef = {
  spec: ClaudeToolSpec;
  artifactType: ResearchArtifactType;
  /** Industries where this tool is highest-value (drives ordering). */
  industryAffinity?: Industry[];
  /** Returns false to skip registration entirely (e.g. missing API key). */
  isAvailable: () => boolean;
  /** Pure tool implementation. */
  handler: (input: Record<string, unknown>, ctx: ToolContext) => Promise<ToolHandlerResult>;
};

// ---------------------------------------------------------------------------
// Artifact-writing wrapper used by the agent loop
// ---------------------------------------------------------------------------

/**
 * Wrap a ToolDef handler so every successful (and soft-failed) invocation
 * writes a ResearchArtifact row. The agent loop calls this — tools
 * themselves don't touch Prisma directly.
 */
export async function executeTool(
  def: ToolDef,
  call: ClaudeToolCall,
  ctx: ToolContext,
): Promise<ClaudeToolResult> {
  let result: ToolHandlerResult;
  try {
    result = await def.handler(call.input, ctx);
  } catch (err) {
    return {
      tool_use_id: call.id,
      content: `Tool "${call.name}" threw: ${(err as Error).message}`,
      isError: true,
    };
  }

  // Best-effort artifact write — never block the agent loop on a DB hiccup.
  try {
    await prisma.researchArtifact.create({
      data: {
        leadId: ctx.leadId,
        type: def.artifactType,
        sourceUrl: result.sourceUrl ?? null,
        payload: {
          tool: call.name,
          input: call.input,
          ...result.payload,
          isError: result.isError ?? false,
        } as never,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[tools] artifact write failed for ${call.name}:`, (err as Error).message);
  }

  return {
    tool_use_id: call.id,
    content: result.content,
    isError: result.isError ?? false,
  };
}

// ---------------------------------------------------------------------------
// Phase 1 tools: web_search, fetch_url, find_emails
// ---------------------------------------------------------------------------

const webSearchTool: ToolDef = {
  spec: {
    name: "web_search",
    description:
      "Search the public web for facts about the lead. Use to find news mentions, leadership names, " +
      "competitor mentions, recent expansions, or to route AROUND Cloudflare-protected homepages by " +
      "searching for the business name + city and reading directory-site snippets. Backed by Tavily " +
      "(LLM-grounded) with Brave and DuckDuckGo as fallbacks.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Natural-language query. Quote the business name for exact match. Add city/state to disambiguate.",
        },
        max_results: {
          type: "integer",
          description: "1-10. Default 6.",
        },
        topic: {
          type: "string",
          enum: ["general", "news"],
          description: "Use 'news' for recent press / leadership / funding signals; 'general' otherwise.",
        },
      },
      required: ["query"],
    },
  },
  artifactType: ResearchArtifactType.WEB_SEARCH_RESULT,
  isAvailable: () => true, // always — DDG fallback works without keys
  async handler(input) {
    const query = String(input.query ?? "").trim();
    if (!query) {
      return {
        content: "ERROR: query is required",
        payload: { error: "missing_query" },
        isError: true,
      };
    }
    const maxResults = typeof input.max_results === "number" ? input.max_results : 6;
    const topic = input.topic === "news" ? "news" : "general";
    const res = await webSearch(query, { maxResults, topic });
    if (res.results.length === 0) {
      return {
        content: `No results from any search provider (tried Tavily/Brave/DDG).`,
        payload: { provider: res.provider, query, results: [] },
      };
    }
    const formatted = res.results
      .map(
        (r, i) =>
          `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.snippet.slice(0, 280)}`,
      )
      .join("\n\n");
    return {
      content: `Found ${res.results.length} results via ${res.provider}:\n\n${formatted}`,
      payload: { provider: res.provider, query, results: res.results },
    };
  },
};

const fetchUrlTool: ToolDef = {
  spec: {
    name: "fetch_url",
    description:
      "Fetch and read a public web page. Use on the 1-2 most promising results from web_search, or on " +
      "candidate sub-pages like /about or /team. Returns title + cleaned plain-text (capped at ~6KB) + " +
      "extracted emails/phones/social URLs. Cloudflare-protected pages will return http_403 — when that " +
      "happens, fall back to web_search snippets from directory sites.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full https:// URL to fetch." },
      },
      required: ["url"],
    },
  },
  artifactType: ResearchArtifactType.WEBSITE_SNAPSHOT,
  isAvailable: () => true,
  async handler(input) {
    const url = String(input.url ?? "").trim();
    if (!/^https?:\/\//i.test(url)) {
      return {
        content: `ERROR: url must start with http:// or https://`,
        payload: { error: "bad_url", url },
        isError: true,
      };
    }
    const res = await fetchPage(url);
    if (!res.ok) {
      return {
        content: `Fetch failed (${res.reason}). If this looked like a Cloudflare or bot-block, try web_search instead with the business name + city.`,
        payload: { ok: false, reason: res.reason, url },
        sourceUrl: url,
        isError: true,
      };
    }
    const text = res.page.plainText.slice(0, 6000);
    const harvest = harvestFromText(text);
    return {
      content:
        `URL: ${res.finalUrl}\n` +
        `TITLE: ${res.page.title}\n` +
        `OG_DESCRIPTION: ${res.page.metaTags["og:description"] ?? res.page.metaTags["description"] ?? ""}\n` +
        (harvest.emails.length > 0 ? `EMAILS_FOUND: ${harvest.emails.slice(0, 6).join(", ")}\n` : "") +
        (harvest.phones.length > 0 ? `PHONES_FOUND: ${harvest.phones.slice(0, 4).join(", ")}\n` : "") +
        (harvest.linkedinUrls.length > 0 ? `LINKEDIN_URLS: ${harvest.linkedinUrls.slice(0, 3).join(", ")}\n` : "") +
        `---\n${text}`,
      payload: {
        url,
        finalUrl: res.finalUrl,
        title: res.page.title,
        bytes: res.bytes,
        plainText: text,
        metaTags: res.page.metaTags,
        harvest,
      },
      sourceUrl: res.finalUrl,
    };
  },
};

const findEmailsTool: ToolDef = {
  spec: {
    name: "find_emails",
    description:
      "Find probable email addresses for people at a company domain. Uses Hunter.io (free 25/mo) when " +
      "configured; otherwise falls back to regex over text already fetched by other tools this turn. " +
      "Returns up to 6 emails with names/titles when available. Call ONCE you know the canonical domain.",
    input_schema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          description:
            "Bare domain name without protocol or path (e.g. 'lapfcu.org', not 'https://www.lapfcu.org/').",
        },
        limit: {
          type: "integer",
          description: "Max emails to return. 1-10. Default 6.",
        },
      },
      required: ["domain"],
    },
  },
  artifactType: ResearchArtifactType.EMAIL_DISCOVERY,
  isAvailable: () => true,
  async handler(input, ctx) {
    const domain = String(input.domain ?? "")
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .replace(/^www\./i, "");
    if (!domain || !/\./.test(domain)) {
      return {
        content: "ERROR: domain must look like 'example.com'",
        payload: { error: "bad_domain", input: input.domain },
        isError: true,
      };
    }
    const limit = Math.max(1, Math.min(10, typeof input.limit === "number" ? input.limit : 6));

    // 1. Hunter.io if configured.
    const hunterKey = env().HUNTER_API_KEY;
    if (hunterKey) {
      const found = await hunterDomainSearch(domain, limit, hunterKey);
      if (found && found.emails.length > 0) {
        return {
          content:
            `Hunter.io returned ${found.emails.length} email(s) for ${domain}:\n` +
            found.emails
              .map(
                (e) =>
                  `  ${e.value}${e.first_name || e.last_name ? ` — ${[e.first_name, e.last_name].filter(Boolean).join(" ")}` : ""}${e.position ? ` (${e.position})` : ""}${e.confidence != null ? ` [conf ${e.confidence}]` : ""}`,
              )
              .join("\n"),
          payload: { provider: "hunter", domain, ...found },
          sourceUrl: `https://hunter.io/companies/${encodeURIComponent(domain)}`,
        };
      }
      if (found && found.emails.length === 0) {
        // Quota burned but nothing found — keep going to regex fallback.
        // eslint-disable-next-line no-console
        console.warn(`[find_emails] Hunter returned no emails for ${domain}`);
      }
    }

    // 2. Regex fallback over recent artifacts.
    const recent = await prisma.researchArtifact.findMany({
      where: { leadId: ctx.leadId, type: ResearchArtifactType.WEBSITE_SNAPSHOT },
      orderBy: { createdAt: "desc" },
      take: 6,
    });
    const seen = new Set<string>();
    const out: Array<{ email: string; source: string }> = [];
    for (const a of recent) {
      const p = a.payload as { plainText?: string } | null;
      const text = typeof p?.plainText === "string" ? p.plainText : "";
      const h = harvestFromText(text);
      for (const e of h.emails) {
        if (e.toLowerCase().includes(domain.toLowerCase()) && !seen.has(e)) {
          seen.add(e);
          out.push({ email: e, source: a.sourceUrl ?? "(scraped page)" });
          if (out.length >= limit) break;
        }
      }
      if (out.length >= limit) break;
    }

    if (out.length === 0) {
      return {
        content:
          `No emails found for ${domain}. ` +
          (hunterKey ? "Hunter returned nothing and " : "Hunter is not configured; ") +
          "regex over scraped pages also turned up nothing on-domain. Try fetch_url on /contact or /team first.",
        payload: { provider: hunterKey ? "hunter+regex" : "regex", domain, emails: [] },
      };
    }
    return {
      content:
        `Regex over previously-fetched pages found ${out.length} email(s) on ${domain}:\n` +
        out.map((o) => `  ${o.email}  (from ${o.source})`).join("\n"),
      payload: { provider: "regex", domain, emails: out },
    };
  },
};

// ---------------------------------------------------------------------------
// Hunter.io domain-search client (free 25/mo).
// Returns null on network/quota error so caller falls back to regex.
// ---------------------------------------------------------------------------

type HunterEmail = {
  value: string;
  type?: string;
  confidence?: number;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
};

async function hunterDomainSearch(
  domain: string,
  limit: number,
  apiKey: string,
): Promise<{ emails: HunterEmail[]; organization?: string } | null> {
  try {
    const u = new URL("https://api.hunter.io/v2/domain-search");
    u.searchParams.set("domain", domain);
    u.searchParams.set("limit", String(limit));
    u.searchParams.set("api_key", apiKey);
    const res = await fetch(u.toString(), {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[hunter] http_${res.status} for ${domain}`);
      return null;
    }
    const data = (await res.json()) as {
      data?: { organization?: string; emails?: HunterEmail[] };
    };
    return {
      emails: Array.isArray(data.data?.emails) ? data.data!.emails! : [],
      organization: data.data?.organization,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public registry
// ---------------------------------------------------------------------------

/** All registered tools. Phase 2/3 lookups append to this list. */
export const ALL_TOOLS: ToolDef[] = [
  webSearchTool,
  fetchUrlTool,
  findEmailsTool,
];

/**
 * Build the per-lead tool list. Filters out unavailable tools and
 * reorders so industry-specific lookups go first when the lead matches
 * their `industryAffinity`. Earlier tools weight higher in Claude's
 * decision-making, so ordering matters.
 */
export function selectToolsFor(lead: { industry: Industry }): ToolDef[] {
  const available = ALL_TOOLS.filter((t) => t.isAvailable());
  const matchesIndustry = (t: ToolDef) =>
    Array.isArray(t.industryAffinity) && t.industryAffinity.includes(lead.industry);
  return [
    ...available.filter(matchesIndustry),
    ...available.filter((t) => !matchesIndustry(t)),
  ];
}

/** Look up a tool by name. Used by the agent loop's dispatch. */
export function findTool(name: string): ToolDef | undefined {
  return ALL_TOOLS.find((t) => t.spec.name === name);
}

import { z } from "zod";
import crypto from "node:crypto";

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(16),
  AUTH_URL: z.string().url().optional(),
  AUTH_SESSION_MAX_AGE_HOURS: z.coerce.number().int().positive().default(12),
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("Gateway TelNet <onboarding@resend.dev>"),
  EMAIL_REPLY_TO: z.string().email().optional(),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),
  BLOB_READ_WRITE_TOKEN: z.string().optional().default(""),
  ASSESSMENT_LINK_EXPIRY_DAYS: z.coerce.number().int().min(1).max(60).default(14),
  SCRAPE_USER_AGENT: z.string().optional().default(""),
  // v3.3.28 — free-tier OSINT providers for agentic lead research. All
  // optional: the tool registry silently skips any provider whose key is
  // absent, falling back to the next provider in priority order.
  TAVILY_API_KEY: z.string().optional().default(""),       // 1000 free queries/mo
  BRAVE_SEARCH_API_KEY: z.string().optional().default(""), // 2000 free queries/mo
  HUNTER_API_KEY: z.string().optional().default(""),       // 25 free email lookups/mo
  NEXT_PUBLIC_APP_NAME: z.string().default("Gateway TelNet Sales Portal"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  // v2.22 — Mapbox: secret token for server-side geocoding + static
  // images, public token for client-side GL JS map rendering.
  MAPBOX_SECRET_TOKEN: z.string().optional().default(""),
  NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN: z.string().optional().default(""),
  // v2.22 — Daily.co API key for creating video/audio call rooms +
  // issuing per-call meeting tokens. Server-only; never exposed to client.
  DAILY_API_KEY: z.string().optional().default(""),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Generated once per process when AUTH_SECRET is missing — sessions in that
 *  process work but don't persist across deploys, forcing the operator to set
 *  AUTH_SECRET in Vercel env for a stable secret. */
let ephemeralSecret: string | null = null;

export function env(): Env {
  if (cached) return cached;

  const source: Record<string, string | undefined> = { ...process.env };

  // Derive URLs from Vercel-injected VERCEL_URL.
  const vercelUrl = source.VERCEL_URL;
  if (!source.AUTH_URL && vercelUrl) source.AUTH_URL = `https://${vercelUrl}`;
  if ((!source.NEXT_PUBLIC_APP_URL || source.NEXT_PUBLIC_APP_URL === "http://localhost:3000") && vercelUrl) {
    source.NEXT_PUBLIC_APP_URL = `https://${vercelUrl}`;
  }

  // v2.14 — AUTH_SECRET handling:
  //   - In a real production runtime (NODE_ENV=production, on Vercel), a
  //     missing AUTH_SECRET is fatal: a per-process ephemeral would silently
  //     invalidate every session on every redeploy, locking the team out.
  //   - In dev / test / Vercel BUILD phase (which sets NEXT_PHASE=phase-production-build),
  //     fall back to an ephemeral so the build can complete before the
  //     operator pastes the real secret.
  const isProdRuntime =
    source.NODE_ENV === "production" &&
    source.NEXT_PHASE !== "phase-production-build" &&
    source.SKIP_AUTH_SECRET_CHECK !== "1";

  if (!source.AUTH_SECRET || source.AUTH_SECRET.length < 16) {
    if (isProdRuntime) {
      // eslint-disable-next-line no-console
      console.error(
        "[env] AUTH_SECRET missing in production runtime.\n" +
        "        Set AUTH_SECRET in Vercel → Settings → Environment Variables.\n" +
        "        Generate one with: openssl rand -base64 32",
      );
      throw new Error(
        "AUTH_SECRET is required in production. Set it in Vercel env.",
      );
    }
    if (!ephemeralSecret) {
      ephemeralSecret = crypto.randomBytes(48).toString("base64");
      // eslint-disable-next-line no-console
      console.warn(
        "[env] AUTH_SECRET missing — generated an ephemeral secret. " +
        "Set AUTH_SECRET in Vercel env (Settings → Environment Variables) for stable sessions.",
      );
    }
    source.AUTH_SECRET = ephemeralSecret;
  }

  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables — see .env.example");
  }
  cached = parsed.data;
  return cached;
}

/**
 * v2.14 — Runtime integration health snapshot.
 *
 * Cheap pure function: doesn't call any external service, just reads
 * `env()` and reports which optional integrations are configured. Used by:
 *   - the boot banner (logged once per server process)
 *   - the /admin/setup wizard checklist
 *   - any UI that wants to show a "feature disabled" badge
 */
export type IntegrationHealth = {
  authSecretStable: boolean;
  resend: { configured: boolean; var: "RESEND_API_KEY"; degradedFeatures: string[] };
  blob: { configured: boolean; var: "BLOB_READ_WRITE_TOKEN"; degradedFeatures: string[] };
  anthropic: { configured: boolean; var: "ANTHROPIC_API_KEY"; degradedFeatures: string[] };
  database: { configured: boolean; var: "DATABASE_URL"; degradedFeatures: string[] };
  // v2.22
  mapbox: { configured: boolean; var: "MAPBOX_SECRET_TOKEN + NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN"; degradedFeatures: string[] };
  daily: { configured: boolean; var: "DAILY_API_KEY"; degradedFeatures: string[] };
  // v3.3.28 — free-tier OSINT search providers (Tavily > Brave > DDG fallback)
  tavily: { configured: boolean; var: "TAVILY_API_KEY"; degradedFeatures: string[] };
  brave: { configured: boolean; var: "BRAVE_SEARCH_API_KEY"; degradedFeatures: string[] };
  hunter: { configured: boolean; var: "HUNTER_API_KEY"; degradedFeatures: string[] };
};

export function integrationHealth(): IntegrationHealth {
  const e = env();
  return {
    authSecretStable: Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16),
    resend: {
      configured: Boolean(e.RESEND_API_KEY),
      var: "RESEND_API_KEY",
      degradedFeatures: ["Magic-link sign-in", "Outreach email delivery", "Assessment invite emails"],
    },
    blob: {
      configured: Boolean(e.BLOB_READ_WRITE_TOKEN),
      var: "BLOB_READ_WRITE_TOKEN",
      degradedFeatures: ["File attachments", "Signed-document uploads"],
    },
    anthropic: {
      configured: Boolean(e.ANTHROPIC_API_KEY),
      var: "ANTHROPIC_API_KEY",
      degradedFeatures: ["Auto research summaries"],
    },
    database: {
      configured: Boolean(e.DATABASE_URL),
      var: "DATABASE_URL",
      degradedFeatures: ["Everything (app cannot run without DB)"],
    },
    // v2.22 — Mapbox needs BOTH tokens: secret for server geocoding,
    // public for client GL JS. Either missing → maps disabled.
    mapbox: {
      configured: Boolean(e.MAPBOX_SECRET_TOKEN && e.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN),
      var: "MAPBOX_SECRET_TOKEN + NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN",
      degradedFeatures: ["Lead geocoding", "/leads/map view", "Polygon territory editor"],
    },
    daily: {
      configured: Boolean(e.DAILY_API_KEY),
      var: "DAILY_API_KEY",
      degradedFeatures: ["In-portal video / audio calls"],
    },
    // v3.3.28 — agentic OSINT research providers. Missing keys aren't
    // fatal: the search façade falls Tavily → Brave → DuckDuckGo, and
    // Hunter falls back to regex over already-scraped pages.
    tavily: {
      configured: Boolean(e.TAVILY_API_KEY),
      var: "TAVILY_API_KEY",
      degradedFeatures: ["Higher-quality LLM-grounded web search (falls back to Brave/DDG)"],
    },
    brave: {
      configured: Boolean(e.BRAVE_SEARCH_API_KEY),
      var: "BRAVE_SEARCH_API_KEY",
      degradedFeatures: ["Brave Search fallback when Tavily quota hits (falls back to DDG)"],
    },
    hunter: {
      configured: Boolean(e.HUNTER_API_KEY),
      var: "HUNTER_API_KEY",
      degradedFeatures: ["Domain-to-email lookups (falls back to regex over scraped pages)"],
    },
  };
}

let bannerLogged = false;

/**
 * Logs a one-time integration-health banner on first call. Safe to call
 * from any server entry point; deduped via a module-scoped flag.
 */
export function logIntegrationHealthBanner(): void {
  if (bannerLogged) return;
  bannerLogged = true;
  const h = integrationHealth();
  const lines = [
    "════════════ Gateway TelNet — integration health ════════════",
    `  AUTH_SECRET stable:    ${h.authSecretStable ? "✓" : "⚠ ephemeral (set AUTH_SECRET)"}`,
    `  DATABASE_URL set:      ${h.database.configured ? "✓" : "✗"}`,
    `  RESEND_API_KEY set:    ${h.resend.configured ? "✓" : "⚠ disabled — magic-link + outreach degraded"}`,
    `  BLOB_READ_WRITE_TOKEN: ${h.blob.configured ? "✓" : "⚠ disabled — file uploads will return 503"}`,
    `  ANTHROPIC_API_KEY:     ${h.anthropic.configured ? "✓" : "⚠ disabled — auto research summary off"}`,
    `  TAVILY_API_KEY:        ${h.tavily.configured ? "✓" : "○ optional — falls back to Brave/DDG"}`,
    `  BRAVE_SEARCH_API_KEY:  ${h.brave.configured ? "✓" : "○ optional — falls back to DDG"}`,
    `  HUNTER_API_KEY:        ${h.hunter.configured ? "✓" : "○ optional — falls back to page regex"}`,
    "═════════════════════════════════════════════════════════════",
  ];
  // eslint-disable-next-line no-console
  console.log(lines.join("\n"));
}

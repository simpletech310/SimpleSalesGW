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
  NEXT_PUBLIC_APP_NAME: z.string().default("Gateway TelNet Sales Portal"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
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

  // Build-safety: if AUTH_SECRET is missing (e.g. first Vercel deploy before the
  // operator pastes the secret), fall back to a per-process random. Logs warn
  // loudly so operators see they must set AUTH_SECRET for production sessions.
  if (!source.AUTH_SECRET || source.AUTH_SECRET.length < 16) {
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

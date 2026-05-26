#!/usr/bin/env node
/**
 * Vercel build wrapper.
 *
 * 1. Derives AUTH_URL / NEXT_PUBLIC_APP_URL from VERCEL_URL when not set.
 * 2. Runs `prisma generate` (always).
 * 3. If DATABASE_URL is present, runs `prisma migrate deploy` then `tsx prisma/seed.ts`.
 *    If DATABASE_URL is missing (first deploy before Postgres integration is connected),
 *    logs a clear warning and skips so the Next build still succeeds.
 * 4. Runs `next build`.
 *
 * This is the same script local users get via `npm run build` and Vercel runs in CI.
 */

import { spawnSync } from "node:child_process";

const log = (msg) => console.log(`[vercel-build] ${msg}`);

function run(cmd, args) {
  log(`▶ ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    log(`✖ ${cmd} exited with ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

function maybeRun(cmd, args) {
  log(`▶ ${cmd} ${args.join(" ")} (best-effort)`);
  const result = spawnSync(cmd, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    log(`⚠ ${cmd} failed with ${result.status} — continuing.`);
  }
}

// Derive URLs from Vercel-injected VERCEL_URL when missing.
if (!process.env.AUTH_URL && process.env.VERCEL_URL) {
  process.env.AUTH_URL = `https://${process.env.VERCEL_URL}`;
  log(`Derived AUTH_URL = ${process.env.AUTH_URL}`);
}
if (!process.env.NEXT_PUBLIC_APP_URL && process.env.VERCEL_URL) {
  process.env.NEXT_PUBLIC_APP_URL = `https://${process.env.VERCEL_URL}`;
  log(`Derived NEXT_PUBLIC_APP_URL = ${process.env.NEXT_PUBLIC_APP_URL}`);
}

// Always generate the Prisma client.
run("npx", ["prisma", "generate"]);

if (process.env.DATABASE_URL) {
  // v3.3.19 — Neon's pooled endpoint (`-pooler` in the hostname) is
  // pgbouncer in transaction mode and can't hold the session-scoped
  // advisory locks Prisma uses to serialize migrations. Migration
  // deploys against the pooler fail with P1002 "timed out trying to
  // acquire a postgres advisory lock". Schema's datasource now reads
  // `directUrl = env("DIRECT_URL")`, but only if DIRECT_URL is set.
  // Resolve it here from common provider env names, or derive one by
  // stripping `-pooler` from the pooled hostname.
  if (!process.env.DIRECT_URL) {
    const candidates = [
      process.env.DATABASE_URL_UNPOOLED,
      process.env.POSTGRES_URL_NON_POOLING,
      process.env.DIRECT_DATABASE_URL,
    ].filter(Boolean);
    let resolved = candidates[0];
    if (!resolved && /-pooler\b/.test(process.env.DATABASE_URL)) {
      resolved = process.env.DATABASE_URL.replace(/-pooler\b/, "");
      log("⚠ DIRECT_URL not set — derived by stripping `-pooler` from DATABASE_URL.");
      log("  For best reliability set DIRECT_URL explicitly in Vercel env.");
    }
    if (resolved) {
      process.env.DIRECT_URL = resolved;
      try {
        const h = new URL(resolved).hostname;
        log(`Resolved DIRECT_URL for migrate deploy (host = ${h}).`);
      } catch {
        log("Resolved DIRECT_URL for migrate deploy.");
      }
    } else {
      log("DIRECT_URL not set + couldn't derive one — using DATABASE_URL for migrations (may fail on Neon pooler with P1002).");
    }
  }
  // v3.3.20 — Even on the direct URL, Prisma's advisory-lock
  // acquire times out when a stale session from a prior failed
  // deploy never released it (Neon's autosuspend can leave zombie
  // session-scoped locks). Per Prisma docs (pris.ly/d/migrate-
  // advisory-locking), the right move in CI/CD where the
  // orchestrator already serializes deploys is to skip the
  // advisory lock entirely. Migrations still run inside a
  // transaction so safety per-migration is preserved.
  process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK = "1";
  log("PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1 — Vercel serializes deploys, lock not needed.");
  log("DATABASE_URL present — running migrations and seed.");
  run("npx", ["prisma", "migrate", "deploy"]);
  // Seeding is idempotent (upserts) — safe to run on every deploy.
  maybeRun("npx", ["tsx", "prisma/seed.ts"]);
} else {
  log("⚠ DATABASE_URL missing — skipping migrations and seed.");
  log("   Connect the Vercel Postgres integration in the project dashboard,");
  log("   then redeploy.");
}

run("npx", ["next", "build"]);
log("✓ build complete");

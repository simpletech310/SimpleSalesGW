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

/**
 * v2.21 — MSP profile loader.
 *
 * Default: DEFAULT_PROFILE in src/lib/msp/profile.ts.
 * Override: SystemConfig row with key `msp.profile` holds a full
 * MspProfile as JSONB. SUPERADMIN edits it at /admin/msp-profile.
 *
 * Returned profile is cached for the lifetime of the process — the
 * admin UI invalidates the cache when it writes.
 *
 * Mirrors src/lib/pricing/loader.ts:15-36.
 */

import { prisma } from "@/lib/prisma";
import { DEFAULT_PROFILE, type MspProfile } from "./profile";

let cached: { profile: MspProfile; loadedAt: number } | null = null;
const TTL_MS = 30_000; // re-read at most every 30s

export async function loadProfile(): Promise<MspProfile> {
  const now = Date.now();
  if (cached && now - cached.loadedAt < TTL_MS) return cached.profile;

  try {
    const row = await prisma.systemConfig.findUnique({ where: { key: "msp.profile" } });
    const profile = (row?.value as MspProfile | null) ?? DEFAULT_PROFILE;
    cached = { profile, loadedAt: now };
    return profile;
  } catch {
    // If the DB is unreachable, fall back to defaults so the build/SSR
    // never crashes. Same pattern as loadCatalog.
    return DEFAULT_PROFILE;
  }
}

/** Force-clear the cache (called after admin save). */
export function invalidateProfileCache(): void {
  cached = null;
}

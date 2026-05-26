/**
 * Loads the active pricing catalog at runtime.
 *
 * Default: the static catalog in src/lib/pricing/catalog.ts.
 * Override: SystemConfig row with key `pricing.catalog` holds a full catalog
 * as JSONB. Superadmin can edit it at /admin/pricing.
 *
 * Returned catalog is cached for the lifetime of the process — the admin UI
 * invalidates the cache when it writes.
 */

import { prisma } from "@/lib/prisma";
import { DEFAULT_CATALOG, type PricingCatalog, type BundleDefinition } from "./catalog";

let cached: { catalog: PricingCatalog; loadedAt: number } | null = null;
const TTL_MS = 30_000; // re-read at most every 30s

/**
 * v3.3.4 — Backfill rep-pitch fields from defaults so a pre-existing
 * admin override (saved before pitch existed) still surfaces the
 * sales-rep guide. The override wins on numbers; defaults fill in any
 * `pitch` that's missing.
 */
function mergePitches(catalog: PricingCatalog): PricingCatalog {
  let touched = false;
  const merged: Record<string, BundleDefinition> = {};
  const defaults = DEFAULT_CATALOG.bundles as Record<string, BundleDefinition>;
  for (const [id, b] of Object.entries(catalog.bundles)) {
    const defaultPitch = defaults[id]?.pitch;
    if (!b.pitch && defaultPitch) {
      merged[id] = { ...b, pitch: defaultPitch };
      touched = true;
    } else {
      merged[id] = b;
    }
  }
  if (!touched) return catalog;
  return { ...catalog, bundles: merged as PricingCatalog["bundles"] };
}

export async function loadCatalog(): Promise<PricingCatalog> {
  const now = Date.now();
  if (cached && now - cached.loadedAt < TTL_MS) return cached.catalog;

  try {
    const row = await prisma.systemConfig.findUnique({ where: { key: "pricing.catalog" } });
    const raw = (row?.value as PricingCatalog | null) ?? DEFAULT_CATALOG;
    const catalog = mergePitches(raw);
    cached = { catalog, loadedAt: now };
    return catalog;
  } catch {
    // If the DB is unreachable, fall back to defaults so the build/SSR doesn't crash.
    return DEFAULT_CATALOG;
  }
}

/** Force-clear the cache (called after admin write). */
export function invalidateCatalogCache(): void {
  cached = null;
}

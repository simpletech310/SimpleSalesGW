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
import { DEFAULT_CATALOG, type PricingCatalog } from "./catalog";

let cached: { catalog: PricingCatalog; loadedAt: number } | null = null;
const TTL_MS = 30_000; // re-read at most every 30s

export async function loadCatalog(): Promise<PricingCatalog> {
  const now = Date.now();
  if (cached && now - cached.loadedAt < TTL_MS) return cached.catalog;

  try {
    const row = await prisma.systemConfig.findUnique({ where: { key: "pricing.catalog" } });
    const catalog = (row?.value as PricingCatalog | null) ?? DEFAULT_CATALOG;
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

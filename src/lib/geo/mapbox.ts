/**
 * v2.22 — Server-side Mapbox geocoder + point-in-polygon helper.
 *
 * Uses MAPBOX_SECRET_TOKEN to call the Mapbox Geocoding API. Cached
 * in-process for 24h keyed by the full address string to stay under
 * the per-month quota when leads get patched repeatedly.
 *
 * Never imported from client components.
 */

import { env } from "@/lib/env";

export type LatLng = { lat: number; lng: number };

export type AddressInput = {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

type CacheEntry = { result: LatLng | null; ts: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

function cacheKey(a: AddressInput): string {
  return [a.street, a.city, a.state, a.zip].filter(Boolean).join("|").toLowerCase();
}

/**
 * Geocode a single address. Returns `null` if Mapbox can't find a match
 * or the API key isn't configured. Never throws — failure is a silent
 * `null` so the lead-save flow doesn't break when Mapbox is degraded.
 */
export async function geocodeAddress(a: AddressInput): Promise<LatLng | null> {
  const key = cacheKey(a);
  if (!key) return null;

  // Cached hit?
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.result;

  const token = env().MAPBOX_SECRET_TOKEN;
  if (!token) return null;

  const query = [a.street, a.city, a.state, a.zip].filter(Boolean).join(", ");
  if (!query) return null;

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("country", "us");
  url.searchParams.set("limit", "1");
  url.searchParams.set("types", "address,place,postcode");

  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) {
      cache.set(key, { result: null, ts: Date.now() });
      return null;
    }
    const data = (await res.json()) as {
      features?: Array<{ center?: [number, number] }>;
    };
    const center = data.features?.[0]?.center;
    if (!center || center.length !== 2) {
      cache.set(key, { result: null, ts: Date.now() });
      return null;
    }
    const result: LatLng = { lat: center[1]!, lng: center[0]! };
    cache.set(key, { result, ts: Date.now() });
    return result;
  } catch {
    cache.set(key, { result: null, ts: Date.now() });
    return null;
  }
}

/**
 * Point-in-polygon test (ray casting). Polygon is a closed ring of
 * `[lng, lat]` pairs. Used by territory matching when a territory has
 * a polygon defined.
 */
export function pointInPolygon(
  point: LatLng,
  polygon: ReadonlyArray<[number, number]>,
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]![0];
    const yi = polygon[i]![1];
    const xj = polygon[j]![0];
    const yj = polygon[j]![1];

    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Helper: extract a polygon's outer ring from the GeoJSON-style shape
 * we store in SalesTerritory.polygon.
 *
 * Accepts: { type: "Polygon", coordinates: [[[lng, lat], ...]] }
 * Returns: [[lng, lat], ...] (the outer ring) or null.
 */
export function extractPolygonRing(polygon: unknown): ReadonlyArray<[number, number]> | null {
  if (!polygon || typeof polygon !== "object") return null;
  const p = polygon as { type?: string; coordinates?: unknown };
  if (p.type !== "Polygon" || !Array.isArray(p.coordinates) || p.coordinates.length === 0) return null;
  const ring = p.coordinates[0];
  if (!Array.isArray(ring)) return null;
  const out: Array<[number, number]> = [];
  for (const pt of ring) {
    if (!Array.isArray(pt) || pt.length !== 2) return null;
    const lng = Number(pt[0]);
    const lat = Number(pt[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    out.push([lng, lat]);
  }
  return out;
}

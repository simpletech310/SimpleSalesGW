/**
 * v2.22 — Territory matching.
 *
 * Match a lead's address against active territories. First match wins.
 * Match precedence (most specific first):
 *   1. polygon (if lat/lng available + territory has polygon)
 *   2. zip code exact match
 *   3. city + state pair match
 *   4. state-only match
 *
 * Returns the matched territory or null.
 */

import { prisma } from "@/lib/prisma";
import { extractPolygonRing, pointInPolygon, type LatLng } from "@/lib/geo/mapbox";

export type TerritoryMatchInput = {
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  /** Optional — enables polygon matching. */
  latLng?: LatLng | null;
};

export type MatchedTerritory = {
  id: string;
  name: string;
  teamId: string;
  matchedOn: "polygon" | "zip" | "city" | "state";
};

type CityEntry = { city: string; state: string };

function parseCities(value: unknown): CityEntry[] {
  if (!Array.isArray(value)) return [];
  const out: CityEntry[] = [];
  for (const v of value) {
    if (v && typeof v === "object") {
      const e = v as { city?: unknown; state?: unknown };
      if (typeof e.city === "string" && typeof e.state === "string") {
        out.push({ city: e.city.trim().toLowerCase(), state: e.state.trim().toUpperCase() });
      }
    }
  }
  return out;
}

export async function matchTerritoryForLead(
  input: TerritoryMatchInput,
): Promise<MatchedTerritory | null> {
  const { city, state, zip, latLng } = input;
  if (!city && !state && !zip && !latLng) return null;

  // Pull all active territories. In practice this is small (dozens at
  // most per org); we evaluate in-memory for clarity + to support the
  // polygon case which Postgres can't express simply.
  const territories = await prisma.salesTerritory.findMany({
    where: { active: true, team: { active: true } },
    select: {
      id: true,
      name: true,
      teamId: true,
      states: true,
      zipCodes: true,
      cities: true,
      polygon: true,
    },
  });

  const cityLower = city?.trim().toLowerCase() ?? null;
  const stateUpper = state?.trim().toUpperCase() ?? null;
  const zipTrim = zip?.trim() ?? null;

  // Pass 1 — polygon (most specific)
  if (latLng) {
    for (const t of territories) {
      const ring = extractPolygonRing(t.polygon);
      if (ring && pointInPolygon(latLng, ring)) {
        return { id: t.id, name: t.name, teamId: t.teamId, matchedOn: "polygon" };
      }
    }
  }

  // Pass 2 — zip code
  if (zipTrim) {
    for (const t of territories) {
      if (t.zipCodes.includes(zipTrim)) {
        return { id: t.id, name: t.name, teamId: t.teamId, matchedOn: "zip" };
      }
    }
  }

  // Pass 3 — city + state
  if (cityLower && stateUpper) {
    for (const t of territories) {
      const cities = parseCities(t.cities);
      if (cities.some((c) => c.city === cityLower && c.state === stateUpper)) {
        return { id: t.id, name: t.name, teamId: t.teamId, matchedOn: "city" };
      }
    }
  }

  // Pass 4 — state only (most permissive)
  if (stateUpper) {
    for (const t of territories) {
      if (t.states.includes(stateUpper)) {
        return { id: t.id, name: t.name, teamId: t.teamId, matchedOn: "state" };
      }
    }
  }

  return null;
}

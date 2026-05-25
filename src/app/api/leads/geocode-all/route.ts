import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";
import { leadVisibilityFilter } from "@/lib/rbac";
import { userTeamIds } from "@/lib/sales/teams";
import { geocodeAddress } from "@/lib/geo/mapbox";
import { matchTerritoryForLead } from "@/lib/sales/territories";
import { env } from "@/lib/env";

/**
 * v2.23.2 — POST /api/leads/geocode-all
 *
 * One-click bulk backfill for leads that don't have lat/lng yet
 * (typically: leads created before Mapbox was configured, or where
 * the fire-and-forget geocode on lead-create silently failed).
 *
 * Scoped to the caller's visibility (SALESPERSON only backfills own +
 * team leads; SALES_MANAGER backfills everything). Capped at 200
 * leads per request to keep the round-trip bounded; the client can
 * click again if more remain.
 *
 * Runs serially with a tiny per-call delay so we don't smash Mapbox's
 * per-second rate limit (600 req/min on free tier).
 */
const MAX_PER_RUN = 200;
const SLEEP_MS = 60; // ~16 req/s — well under Mapbox limits

export async function POST(_req: Request) {
  try {
    const user = await requireSessionUser();

    if (!env().MAPBOX_SECRET_TOKEN) {
      throw new ApiError(
        503,
        "Mapbox isn't configured (MAPBOX_SECRET_TOKEN missing). Set it in Vercel env first.",
      );
    }

    const teamIds = await userTeamIds(user.id);
    const filter = leadVisibilityFilter(user.role, user.id, teamIds);

    const candidates = await prisma.lead.findMany({
      where: {
        AND: [
          filter,
          { addressLat: null },
          {
            // Need at least city + state OR a zip to have any chance of geocoding
            OR: [{ addressZip: { not: null } }, { addressCity: { not: null }, addressState: { not: null } }],
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_PER_RUN,
      select: {
        id: true,
        teamId: true,
        addressStreet: true,
        addressCity: true,
        addressState: true,
        addressZip: true,
      },
    });

    let geocoded = 0;
    let failed = 0;
    let teamAssigned = 0;

    for (const lead of candidates) {
      try {
        const latLng = await geocodeAddress({
          street: lead.addressStreet,
          city: lead.addressCity,
          state: lead.addressState,
          zip: lead.addressZip,
        });
        if (!latLng) {
          failed += 1;
          continue;
        }
        const match = await matchTerritoryForLead({
          city: lead.addressCity,
          state: lead.addressState,
          zip: lead.addressZip,
          latLng,
        });
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            addressLat: latLng.lat,
            addressLng: latLng.lng,
            geocodedAt: new Date(),
            ...(lead.teamId == null && match
              ? { teamId: match.teamId, territoryId: match.id }
              : {}),
          },
        });
        geocoded += 1;
        if (lead.teamId == null && match) teamAssigned += 1;
        // Gentle rate-limit pacing
        if (SLEEP_MS > 0) await new Promise((r) => setTimeout(r, SLEEP_MS));
      } catch {
        failed += 1;
      }
    }

    return NextResponse.json({
      candidates: candidates.length,
      geocoded,
      failed,
      teamAssigned,
      moreRemaining: candidates.length === MAX_PER_RUN,
    });
  } catch (err) {
    return jsonError(err);
  }
}

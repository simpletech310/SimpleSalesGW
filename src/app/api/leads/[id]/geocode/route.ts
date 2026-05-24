import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";
import { can, leadIsVisible } from "@/lib/rbac";
import { userTeamIds } from "@/lib/sales/teams";
import { geocodeAddress } from "@/lib/geo/mapbox";
import { matchTerritoryForLead } from "@/lib/sales/territories";

/**
 * v2.22 — POST /api/leads/[id]/geocode
 *
 * Re-geocode the lead's address via Mapbox and re-match against
 * active territories. Auto-assigns team if currently null and the
 * matched territory has one. Idempotent — safe to call repeatedly.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: {
        ownerUserId: true,
        pipelineStage: true,
        teamId: true,
        addressStreet: true,
        addressCity: true,
        addressState: true,
        addressZip: true,
      },
    });
    if (!lead) throw new ApiError(404, "Lead not found");

    const teams = await userTeamIds(user.id);
    if (!leadIsVisible(user.role, user.id, lead.ownerUserId, lead.pipelineStage, lead.teamId, teams)) {
      throw new ApiError(403, "Forbidden");
    }

    // Owner / mgr can trigger; rep can trigger for their own leads
    const isOwnerOrMgr = lead.ownerUserId === user.id || can(user.role, "lead:edit:any");
    if (!isOwnerOrMgr) throw new ApiError(403, "Forbidden");

    const latLng = await geocodeAddress({
      street: lead.addressStreet,
      city: lead.addressCity,
      state: lead.addressState,
      zip: lead.addressZip,
    });

    const match = await matchTerritoryForLead({
      city: lead.addressCity,
      state: lead.addressState,
      zip: lead.addressZip,
      latLng,
    });

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        addressLat: latLng ? latLng.lat : null,
        addressLng: latLng ? latLng.lng : null,
        geocodedAt: latLng ? new Date() : null,
        // Auto-assign team/territory only if currently null (don't
        // override a manual assignment).
        ...(lead.teamId == null && match
          ? { teamId: match.teamId, territoryId: match.id }
          : {}),
      },
    });

    return NextResponse.json({
      lat: updated.addressLat,
      lng: updated.addressLng,
      territory: match ? { id: match.id, name: match.name, matchedOn: match.matchedOn } : null,
      teamAssigned: lead.teamId == null && match ? match.teamId : null,
    });
  } catch (err) {
    return jsonError(err);
  }
}

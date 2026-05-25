import Link from "next/link";
import { redirect } from "next/navigation";
import { PipelineStage } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can, leadVisibilityFilter } from "@/lib/rbac";
import { userTeamIds } from "@/lib/sales/teams";
import { STRINGS } from "@/lib/strings";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { scoreBadgeClass, formatScore } from "@/lib/utils";
// v2.23.1 — Map merged onto the leads page (top section). Standalone
// /leads/map now redirects here. Loaded as a client component (uses
// Mapbox GL JS) and only renders when the user has geocoded leads.
import { LeadsMap } from "./map/LeadsMap";
// v2.23.2 — One-click bulk-geocode for leads that don't have lat/lng yet
import { GeocodeAllButton } from "./GeocodeAllButton";

export const dynamic = "force-dynamic";

const ACTIVE_STAGES: PipelineStage[] = [
  PipelineStage.LEAD,
  PipelineStage.QUALIFIED,
  PipelineStage.DISCOVERY,
  PipelineStage.PRE_SALES,
  PipelineStage.PROPOSAL,
  PipelineStage.NEGOTIATION,
];

export default async function LeadsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const exportAllowed = can(session.user.role, "data:export");
  const seesAllLeads = can(session.user.role, "lead:view:all");

  // v2.23.1 — feed team memberships into the filter so SALESPERSONs
  // also see leads on teams they're a member of (was a v2.22 oversight
  // here; pre-existing leadVisibilityFilter call took role+userId only).
  const teamIds = await userTeamIds(session.user.id);
  const leads = await prisma.lead.findMany({
    where: leadVisibilityFilter(session.user.role, session.user.id, teamIds),
    orderBy: { updatedAt: "desc" },
    include: {
      owner: { select: { id: true, name: true } },
      team: { select: { name: true } },
    },
  });

  // v2.23.1 — leads with geocoded coordinates feed the map on top.
  // Same visibility filter, but we drop ungeocoded rows to avoid 0,0
  // markers in the Gulf of Guinea.
  const mapLeads = leads
    .filter((l) => l.addressLat != null && l.addressLng != null)
    .map((l) => ({
      id: l.id,
      name: l.businessName,
      stage: l.pipelineStage,
      dq: l.dealQualityScore,
      city: l.addressCity,
      state: l.addressState,
      teamName: l.team?.name ?? null,
      lat: Number(l.addressLat),
      lng: Number(l.addressLng),
    }));

  // v2.23.2 — leads that have any address but no lat/lng — these are
  // the candidates for the bulk-geocode button (typically: leads
  // created before MAPBOX_SECRET_TOKEN was set in Vercel env, or
  // where the fire-and-forget geocode on create silently failed).
  const pendingGeocodeCount = leads.filter(
    (l) =>
      l.addressLat == null &&
      ((l.addressCity && l.addressState) || l.addressZip),
  ).length;

  // v2.14 — team scorecard band for users with team-wide visibility
  // (Sales Manager, COO, Superadmin). Counts per owner across the same
  // visibility filter so the totals exactly match what's in the table below.
  type TeamRow = {
    ownerId: string;
    ownerName: string;
    active: number;
    closedWon: number;
    avgDq: number;
  };
  let teamRows: TeamRow[] = [];
  if (seesAllLeads && leads.length > 0) {
    const byOwner = new Map<string, { name: string; active: number; closedWon: number; dqSum: number; dqCount: number }>();
    for (const l of leads) {
      const key = l.owner.id;
      const row = byOwner.get(key) ?? { name: l.owner.name ?? "—", active: 0, closedWon: 0, dqSum: 0, dqCount: 0 };
      if (ACTIVE_STAGES.includes(l.pipelineStage)) {
        row.active += 1;
        row.dqSum += l.dealQualityScore;
        row.dqCount += 1;
      }
      if (l.pipelineStage === PipelineStage.CLOSED_WON) row.closedWon += 1;
      byOwner.set(key, row);
    }
    teamRows = Array.from(byOwner.entries())
      .map(([ownerId, r]) => ({
        ownerId,
        ownerName: r.name,
        active: r.active,
        closedWon: r.closedWon,
        avgDq: r.dqCount > 0 ? Math.round(r.dqSum / r.dqCount) : 0,
      }))
      .sort((a, b) => b.active - a.active);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gtn-navy">Leads</h1>
          <p className="text-sm text-gtn-grey-2">
            {leads.length} total
            {mapLeads.length > 0 && mapLeads.length < leads.length && (
              <span className="text-gtn-grey-3"> · {mapLeads.length} pinned on map</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {exportAllowed && (
            <Button asChild variant="secondary">
              <a href="/api/export/leads.csv" download>Export CSV</a>
            </Button>
          )}
          {can(session.user.role, "lead:create") && (
            <Button asChild>
              <Link href="/leads/new">+ New Lead</Link>
            </Button>
          )}
        </div>
      </div>

      {/* v2.23.1 — Map of geocoded leads, top of page.
          v2.23.2 — When no leads are geocoded yet but some have an
          address on file, surface a self-healing "Geocode all" button
          so the user can populate the map in one click. */}
      {mapLeads.length > 0 ? (
        <Card className="p-0 overflow-hidden">
          <LeadsMap leads={mapLeads} />
        </Card>
      ) : pendingGeocodeCount > 0 ? (
        <Card>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-gtn-navy">No leads on the map yet</h2>
              <p className="text-xs text-gtn-grey-2 mt-0.5">
                {pendingGeocodeCount} lead{pendingGeocodeCount === 1 ? " has" : "s have"} an address on file but
                no coordinates. Click below to geocode {pendingGeocodeCount === 1 ? "it" : "them all"} now —
                new leads geocode automatically going forward.
              </p>
            </div>
            <GeocodeAllButton pendingCount={pendingGeocodeCount} />
          </div>
        </Card>
      ) : leads.length > 0 ? (
        // v2.23.3 — leads exist but none have an address on file. The
        // create form doesn't require address, so this is the common
        // "imported a list of business names" state. Point at Edit so
        // the rep can add city/state/zip and pop them on the map.
        <Card>
          <h2 className="text-sm font-semibold text-gtn-navy">No leads on the map yet</h2>
          <p className="text-xs text-gtn-grey-2 mt-0.5">
            None of your leads have an address on file yet. Click <strong>Edit</strong> on any lead
            below to add a city + state (or a zip code) — the lead will land on the map automatically.
          </p>
        </Card>
      ) : null}

      {/* v2.14 — Team scorecard band for managers + above */}
      {teamRows.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gtn-navy">Team scorecard</h2>
            <p className="text-xs text-gtn-grey-2">Active in pipeline · Closed-won · Avg DQ</p>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {teamRows.map((r) => (
              <div key={r.ownerId} className="rounded-md border border-gtn-lavender-2 p-3">
                <p className="text-sm font-semibold text-gtn-navy truncate">{r.ownerName}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gtn-grey-2">
                  <span>
                    <span className="font-mono text-gtn-navy font-semibold">{r.active}</span> active
                  </span>
                  <span>
                    <span className="font-mono text-gtn-green font-semibold">{r.closedWon}</span> won
                  </span>
                  <span>
                    avg DQ <span className={scoreBadgeClass(r.avgDq)}>{formatScore(r.avgDq)}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="gtn-card overflow-hidden p-0">
        {/* v2.18 — narrow viewports get horizontal scroll instead of clipping */}
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-gtn-lavender text-left text-xs uppercase tracking-wide text-gtn-grey-2">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3 hidden md:table-cell">Industry</th>
              <th className="px-4 py-3 hidden md:table-cell">Stage</th>
              <th className="px-4 py-3 text-right">DQ</th>
              <th className="px-4 py-3 hidden lg:table-cell">Owner</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const canEditRow =
                l.ownerUserId === session.user.id || can(session.user.role, "lead:edit:any");
              return (
                <tr key={l.id} className="border-t border-gtn-lavender-2 hover:bg-gtn-lavender/40">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${l.id}`} className="text-gtn-navy font-medium hover:underline">
                      {l.businessName}
                    </Link>
                    {l.nonStrategicFlag && (
                      <span className="ml-2 text-[10px] uppercase font-semibold text-gtn-red">Non-strategic</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gtn-grey-2">
                    {l.industry.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="gtn-stage-chip">{STRINGS.pipeline.stages[l.pipelineStage]}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={scoreBadgeClass(l.dealQualityScore)}>
                      {formatScore(l.dealQualityScore)}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gtn-grey-2">{l.owner.name}</td>
                  <td className="px-4 py-3 text-right">
                    {canEditRow ? (
                      <Link
                        href={`/leads/${l.id}/edit`}
                        className="text-xs text-gtn-purple hover:underline"
                      >
                        Edit
                      </Link>
                    ) : (
                      <span className="text-xs text-gtn-grey-3">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {leads.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gtn-grey-2">No leads yet.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

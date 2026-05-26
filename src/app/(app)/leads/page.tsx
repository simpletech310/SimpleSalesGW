import Link from "next/link";
import { redirect } from "next/navigation";
import { PipelineStage } from "@prisma/client";
import { Plus } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can, leadVisibilityFilter } from "@/lib/rbac";
import { userTeamIds } from "@/lib/sales/teams";
import { STRINGS } from "@/lib/strings";
import { Button } from "@/components/ui/Button";
import { Badge, ScoreBadge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ListPage } from "@/components/templates";
import { DashboardSection } from "@/components/templates/DashboardPage";
import { LeadsMap } from "./map/LeadsMap";
import { GeocodeAllButton } from "./GeocodeAllButton";

export const dynamic = "force-dynamic";

// v3.3.22 — MSP-friendly active-stage filter. Legacy PRE_SALES + PROPOSAL
// stay so existing leads still surface on the list.
const ACTIVE_STAGES: PipelineStage[] = [
  PipelineStage.LEAD,
  PipelineStage.QUALIFIED,
  PipelineStage.FIRST_INTERACTION,
  PipelineStage.SITE_SURVEY_SCHEDULED,
  PipelineStage.DISCOVERY,
  PipelineStage.QUOTE_IN_PROGRESS,
  PipelineStage.QUOTE_SENT,
  PipelineStage.PRE_SALES,
  PipelineStage.PROPOSAL,
  PipelineStage.NEGOTIATION,
];

export default async function LeadsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const exportAllowed = can(session.user.role, "data:export");
  const seesAllLeads = can(session.user.role, "lead:view:all");

  const teamIds = await userTeamIds(session.user.id);
  const leads = await prisma.lead.findMany({
    where: leadVisibilityFilter(session.user.role, session.user.id, teamIds),
    orderBy: { updatedAt: "desc" },
    include: {
      owner: { select: { id: true, name: true } },
      team: { select: { name: true } },
    },
  });

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

  const pendingGeocodeCount = leads.filter(
    (l) =>
      l.addressLat == null &&
      ((l.addressCity && l.addressState) || l.addressZip),
  ).length;

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

  type LeadRow = (typeof leads)[number];
  const columns: Column<LeadRow>[] = [
    {
      key: "business",
      header: "Business",
      cell: (l) => (
        <span className="inline-flex items-center gap-2 min-w-0">
          <Link href={`/leads/${l.id}`} className="text-ink-strong font-medium hover:text-gtn-purple truncate">
            {l.businessName}
          </Link>
          {l.nonStrategicFlag && (
            <Badge tone="danger" shape="pill" size="xs">non-strategic</Badge>
          )}
        </span>
      ),
    },
    {
      key: "industry",
      header: "Industry",
      hideOnMobile: true,
      cell: (l) => <span className="text-ink-muted">{l.industry.replace(/_/g, " ").toLowerCase()}</span>,
    },
    {
      key: "stage",
      header: "Stage",
      hideOnMobile: true,
      cell: (l) => <Badge tone="brand" shape="pill" size="sm">{STRINGS.pipeline.stages[l.pipelineStage]}</Badge>,
    },
    {
      key: "dq",
      header: "DQ",
      align: "right",
      width: "70px",
      cell: (l) => <ScoreBadge score={l.dealQualityScore} />,
    },
    {
      key: "owner",
      header: "Owner",
      hideOnMobile: true,
      cell: (l) => <span className="text-ink-muted">{l.owner.name}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "84px",
      cell: (l) => {
        const onTeamForRow = l.teamId ? teamIds.includes(l.teamId) : false;
        const canEditRow =
          l.ownerUserId === session.user.id ||
          can(session.user.role, "lead:edit:any") ||
          onTeamForRow;
        return canEditRow ? (
          <Link href={`/leads/${l.id}/edit`} className="text-xs font-semibold text-gtn-purple hover:underline">
            Edit
          </Link>
        ) : (
          <span className="text-xs text-ink-faint">—</span>
        );
      },
    },
  ];

  return (
    <ListPage
      title="Leads"
      subtitle={
        <>
          {leads.length} total
          {mapLeads.length > 0 && mapLeads.length < leads.length && (
            <span className="text-ink-faint"> · {mapLeads.length} pinned on map</span>
          )}
        </>
      }
      actions={
        <>
          {exportAllowed && (
            <Button asChild variant="secondary" size="sm">
              <a href="/api/export/leads.csv" download>Export CSV</a>
            </Button>
          )}
          {can(session.user.role, "lead:create") && (
            <Button asChild variant="secondary" size="sm">
              <Link href="/leads/import">Bulk import</Link>
            </Button>
          )}
          {can(session.user.role, "lead:create") && (
            <Button asChild size="sm">
              <Link href="/leads/new" className="inline-flex items-center gap-1.5">
                <Plus className="h-4 w-4" />
                New lead
              </Link>
            </Button>
          )}
        </>
      }
      body={
        <div className="space-y-4">
          {/* Map of geocoded leads — top of page. */}
          {mapLeads.length > 0 ? (
            <div className="rounded-xl bg-surface border border-line-subtle overflow-hidden">
              <LeadsMap leads={mapLeads} />
            </div>
          ) : pendingGeocodeCount > 0 ? (
            <div className="rounded-xl bg-surface border border-line-subtle p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-ink-strong">No leads on the map yet</h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  {pendingGeocodeCount} lead{pendingGeocodeCount === 1 ? " has" : "s have"} an address on file but
                  no coordinates. Click below to geocode {pendingGeocodeCount === 1 ? "it" : "them all"} now —
                  new leads geocode automatically going forward.
                </p>
              </div>
              <GeocodeAllButton pendingCount={pendingGeocodeCount} />
            </div>
          ) : leads.length > 0 ? (
            <div className="rounded-xl bg-surface border border-line-subtle p-4">
              <h2 className="text-sm font-semibold text-ink-strong">No leads on the map yet</h2>
              <p className="text-xs text-ink-muted mt-0.5">
                None of your leads have an address on file yet. Click <strong>Edit</strong> on any lead
                below to add a city + state (or a zip code) — the lead will land on the map automatically.
              </p>
            </div>
          ) : null}

          {teamRows.length > 0 && (
            <DashboardSection
              title="Team scorecard"
              subtitle="Active in pipeline · Closed-won · Avg deal quality"
            >
              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {teamRows.map((r) => (
                  <div key={r.ownerId} className="rounded-lg border border-line-subtle bg-surface-2 px-3 py-2.5">
                    <p className="text-sm font-semibold text-ink-strong truncate">{r.ownerName}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-ink-muted">
                      <span><span className="font-mono text-ink-strong font-semibold tabular">{r.active}</span> active</span>
                      <span><span className="font-mono text-success font-semibold tabular">{r.closedWon}</span> won</span>
                      <span className="inline-flex items-center gap-1">
                        avg DQ <ScoreBadge score={r.avgDq} className="!px-1.5 !py-0" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </DashboardSection>
          )}

          <DataTable
            columns={columns}
            rows={leads}
            getRowKey={(l) => l.id}
            empty="No leads yet."
          />
        </div>
      }
    />
  );
}

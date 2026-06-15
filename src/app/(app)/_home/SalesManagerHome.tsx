import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Users,
  DollarSign,
  Inbox,
  Trophy,
  ChevronRight,
  Activity as ActivityIcon,
  AlertTriangle,
  TrendingUp,
  Settings,
  MapPin,
  UserPlus,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/help/EmptyState";
import { PipelineStrip } from "@/components/pipeline/PipelineStrip";
import { ConversionFunnel } from "@/components/ui/Charts";
import { STRINGS } from "@/lib/strings";
import { DashboardPage, DashboardSection } from "@/components/templates";
import { DetailSplit } from "@/components/templates/DetailPage";
import { loadNotifications } from "@/lib/notifications";
import { leadVisibilityFilter } from "@/lib/rbac";
import { PipelineStage, Role, type Role as RoleType } from "@prisma/client";

/**
 * v3.1 — Sales Manager dashboard.
 *
 * Distinct from the rep dashboard. The manager cares about:
 *   - Their pricing-approval queue (5–20% off MRR is theirs to sign off)
 *   - Team-wide pipeline shape (counts per stage)
 *   - Rep performance (active count + close rate this month)
 *   - Unassigned leads (workbench cue)
 *   - Recent team activity (coaching signal)
 *
 * Reuses every existing primitive — no new components.
 */
export async function SalesManagerHome({
  user,
}: {
  user: { id: string; name: string | null; role: RoleType };
}) {
  const firstName = user.name?.split(" ")[0] ?? "there";
  const visibility = leadVisibilityFilter(user.role, user.id);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    notifications,
    teamLeadCount,
    unassignedCount,
    closedWonThisMonth,
    activeReps,
    leadsByStage,
    teamActivity,
  ] = await Promise.all([
    loadNotifications({ id: user.id, role: user.role }),
    prisma.lead.count({ where: visibility }),
    prisma.lead.count({ where: { teamId: null } }),
    prisma.lead.count({
      where: {
        ...visibility,
        pipelineStage: PipelineStage.CLOSED_WON,
        actualCloseDate: { gte: startOfMonth },
      },
    }),
    prisma.user.findMany({
      where: { active: true, role: Role.SALESPERSON },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            ownedLeads: {
              where: {
                pipelineStage: { notIn: [PipelineStage.CLOSED_WON, PipelineStage.CLOSED_LOST] },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.lead.groupBy({
      by: ["pipelineStage"],
      where: visibility,
      _count: { _all: true },
    }),
    prisma.activity.findMany({
      where: { lead: visibility },
      orderBy: { createdAt: "desc" },
      include: {
        lead: { select: { id: true, businessName: true } },
        actor: { select: { id: true, name: true, role: true } },
      },
      take: 6,
    }),
  ]);

  // Closed-won counts per rep this month (separate small query to keep type sane).
  const closedWonPerRep = await prisma.lead.groupBy({
    by: ["ownerUserId"],
    where: {
      pipelineStage: PipelineStage.CLOSED_WON,
      actualCloseDate: { gte: startOfMonth },
    },
    _count: { _all: true },
  });
  const closedWonMap = new Map(closedWonPerRep.map((r) => [r.ownerUserId, r._count._all]));

  const managerApprovals = notifications.pricingApprovalsPending.filter((p) => p.tier === "MANAGER");

  // Top 5 reps by active count, tiebreak by closed-won this month.
  const repsRanked = [...activeReps]
    .map((r) => ({
      id: r.id,
      name: r.name,
      activeCount: r._count.ownedLeads,
      closedWon: closedWonMap.get(r.id) ?? 0,
    }))
    .sort((a, b) => b.activeCount - a.activeCount || b.closedWon - a.closedWon)
    .slice(0, 5);

  // Stage counts as a quick scoreboard (LEAD → CLOSED_WON, ignore LOST/NURTURE for the band).
  // v3.3.22 — MSP-friendly stage flow for the pipeline funnel.
  const stageOrder: PipelineStage[] = [
    PipelineStage.LEAD,
    PipelineStage.QUALIFIED,
    PipelineStage.FIRST_INTERACTION,
    PipelineStage.SITE_SURVEY_SCHEDULED,
    PipelineStage.DISCOVERY,
    PipelineStage.QUOTE_IN_PROGRESS,
    PipelineStage.QUOTE_SENT,
    PipelineStage.NEGOTIATION,
    PipelineStage.CLOSED_WON,
  ];
  const stageCountMap = new Map(leadsByStage.map((r) => [r.pipelineStage, r._count._all]));

  // v3.7 — conversion funnel from LEAD → CLOSED_WON. Each row's % is its
  // share of the stage above it, so a manager can spot exactly where deals
  // stall. Click any band to open that stage on the board.
  const funnelStages = stageOrder.map((s) => ({
    label: STRINGS.pipeline.stages[s] ?? s.replace(/_/g, " "),
    count: stageCountMap.get(s) ?? 0,
    href: `/pipeline?stage=${s}`,
    terminal: s === PipelineStage.CLOSED_WON,
  }));
  const maxRepActive = Math.max(1, ...repsRanked.map((r) => r.activeCount));

  return (
    <DashboardPage
      eyebrow="Sales management"
      title={`Welcome back, ${firstName}`}
      subtitle="Approvals, team performance, and the pipeline at a glance."
      actions={
        <Button asChild size="sm">
          <Link href="/sales/assign">Open assignment workbench →</Link>
        </Button>
      }
      kpis={
        <>
          <StatCard label="Team leads"             value={teamLeadCount}        icon={Users}      tone="brand"   href="/leads" />
          <StatCard label="Pending approvals"      value={managerApprovals.length} icon={DollarSign} tone={managerApprovals.length > 0 ? "warn" : "neutral"} href="/notifications?filter=approvals" sub={managerApprovals.length > 0 ? "5–20% off · yours to decide" : "Queue is clear"} />
          <StatCard label="Unassigned leads"       value={unassignedCount}      icon={Inbox}      tone={unassignedCount > 0 ? "warn" : "success"} href="/sales/assign" sub={unassignedCount > 0 ? "Needs a team" : "All assigned"} />
          <StatCard label="Closed won this mo."    value={closedWonThisMonth}   icon={Trophy}     tone="success" sub={closedWonThisMonth > 0 ? "🎉 Team win" : "First one's coming"} />
        </>
      }
    >
      <PipelineStrip
        counts={Object.fromEntries(stageCountMap) as Partial<Record<PipelineStage, number>>}
        heading="Team pipeline"
      />

      {teamLeadCount > 0 && (
        <DashboardSection
          title="Conversion funnel"
          subtitle="Lead → Closed won. The right-hand % is each stage's pass-through from the one above — your stall points at a glance."
        >
          <ConversionFunnel stages={funnelStages} />
        </DashboardSection>
      )}

      <DetailSplit
        asideWidth="340px"
        main={
          <>
            {/* Approvals queue */}
            <DashboardSection
              title="Approvals waiting on you"
              subtitle="Pricing requests in your 5–20% sign-off tier."
              actions={
                managerApprovals.length > 0 ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/notifications?filter=approvals">All approvals →</Link>
                  </Button>
                ) : undefined
              }
              flush
            >
              {managerApprovals.length === 0 ? (
                <p className="px-5 py-6 text-sm text-ink-muted text-center">
                  Inbox zero — no pricing requests in your queue.
                </p>
              ) : (
                <ul className="divide-y divide-line-subtle">
                  {managerApprovals.slice(0, 5).map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/leads/${p.leadId}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-surface-3/50 transition-colors group"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink-strong group-hover:text-gtn-purple transition-colors truncate">
                            {p.leadName}
                          </p>
                          <p className="text-xs text-ink-muted tabular">
                            <span className="font-semibold text-ink">{p.discountPct}% off</span>{" "}
                            · ${p.proposedPrice.toLocaleString()}/mo · {p.requesterName}
                            <span className="text-ink-faint"> · {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}</span>
                          </p>
                        </div>
                        {p.belowFloor && (
                          <Badge tone="danger" shape="pill" size="xs">below floor</Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-ink-faint flex-shrink-0 group-hover:text-ink transition-colors" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </DashboardSection>

            {/* Recent team activity */}
            <DashboardSection
              title="Recent team activity"
              subtitle="Latest calls, emails, and meetings across the team."
              flush
            >
              {teamActivity.length === 0 ? (
                <p className="px-5 py-6 text-sm text-ink-muted text-center">
                  No team activity logged yet.
                </p>
              ) : (
                <ul className="divide-y divide-line-subtle">
                  {teamActivity.map((a) => (
                    <li key={a.id} className="px-5 py-3">
                      <div className="flex items-start gap-3">
                        <span
                          aria-hidden
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-brand-soft text-gtn-purple flex-shrink-0 mt-0.5"
                        >
                          <ActivityIcon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-ink-strong">
                            <Link
                              href={`/leads/${a.lead.id}`}
                              className="font-semibold hover:text-gtn-purple transition-colors"
                            >
                              {a.lead.businessName}
                            </Link>
                            <span className="text-ink-muted font-normal"> · {a.subject}</span>
                          </p>
                          <p className="text-xs text-ink-muted mt-0.5">
                            {a.type.replace(/_/g, " ").toLowerCase()}
                            {a.actor && (
                              <>
                                {" · "}
                                {a.actor.role === Role.SALESPERSON ? (
                                  <Link
                                    href={`/sales/reps/${a.actor.id}`}
                                    className="hover:text-gtn-purple font-medium"
                                  >
                                    {a.actor.name}
                                  </Link>
                                ) : (
                                  <span>{a.actor.name}</span>
                                )}
                              </>
                            )}
                            <span className="text-ink-faint"> · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span>
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </DashboardSection>
          </>
        }
        aside={
          <>
            {/* Rep leaderboard */}
            <RailCard icon={Trophy} title="Top reps" subtitle="By active leads, tiebreaker = closed-won this month.">
              {repsRanked.length === 0 ? (
                <p className="text-sm text-ink-muted">No active reps yet.</p>
              ) : (
                <ul className="space-y-1">
                  {repsRanked.map((r, i) => (
                    <li key={r.id}>
                      <Link
                        href={`/sales/reps/${r.id}`}
                        className="flex items-center gap-2.5 -mx-2 px-2 py-1.5 rounded-md hover:bg-surface-3/50 transition-colors group"
                      >
                        <span
                          aria-hidden
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold flex-shrink-0 ${
                            i === 0
                              ? "bg-brand text-white"
                              : "bg-surface-3 text-ink-muted"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink-strong group-hover:text-gtn-purple transition-colors truncate">
                            {r.name}
                          </p>
                          <div className="mt-1 h-1.5 rounded-full bg-surface-3 overflow-hidden" aria-hidden>
                            <div
                              className={`h-full rounded-full ${i === 0 ? "bg-brand" : "bg-gtn-purple/45"}`}
                              style={{ width: `${Math.round((r.activeCount / maxRepActive) * 100)}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-ink-muted tabular mt-1">
                            {r.activeCount} active
                            {r.closedWon > 0 && <span className="text-gtn-green font-semibold"> · {r.closedWon} won</span>}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </RailCard>

            {/* Manage your org — quick links into the management surfaces */}
            <RailCard icon={Settings} title="Manage your org" subtitle="Reps, teams, and territories.">
              <ul className="space-y-1 -mx-1">
                <li>
                  <Link
                    href="/sales/reps"
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-surface-3/50 transition-colors group"
                  >
                    <span aria-hidden className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-brand-soft text-gtn-purple flex-shrink-0">
                      <UserPlus className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm font-medium text-ink-strong group-hover:text-gtn-purple transition-colors flex-1">
                      Sales reps
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-ink-faint group-hover:text-gtn-purple transition-colors" />
                  </Link>
                </li>
                <li>
                  <Link
                    href="/sales/teams"
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-surface-3/50 transition-colors group"
                  >
                    <span aria-hidden className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-brand-soft text-gtn-purple flex-shrink-0">
                      <Users className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm font-medium text-ink-strong group-hover:text-gtn-purple transition-colors flex-1">
                      Sales teams
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-ink-faint group-hover:text-gtn-purple transition-colors" />
                  </Link>
                </li>
                <li>
                  <Link
                    href="/sales/territories"
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-surface-3/50 transition-colors group"
                  >
                    <span aria-hidden className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-brand-soft text-gtn-purple flex-shrink-0">
                      <MapPin className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm font-medium text-ink-strong group-hover:text-gtn-purple transition-colors flex-1">
                      Territories
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-ink-faint group-hover:text-gtn-purple transition-colors" />
                  </Link>
                </li>
              </ul>
            </RailCard>

            {/* Unassigned cue */}
            <RailCard
              icon={unassignedCount > 0 ? AlertTriangle : TrendingUp}
              title={unassignedCount > 0 ? "Leads need a team" : "All assigned"}
              subtitle={unassignedCount > 0 ? "Drag them into territories." : "Workbench is clear."}
              tone={unassignedCount > 0 ? "warn" : "neutral"}
            >
              {unassignedCount > 0 ? (
                <Button asChild size="sm" variant="secondary" className="w-full">
                  <Link href="/sales/assign">Open assignment workbench</Link>
                </Button>
              ) : (
                <p className="text-sm text-ink-muted">Every lead has a home. Nice.</p>
              )}
            </RailCard>
          </>
        }
      />

      {/* Bottom-of-page fallback: if the page is *truly* empty */}
      {teamLeadCount === 0 && (
        <DashboardSection>
          <EmptyState
            Icon={Users}
            title="No team activity yet"
            body="Once your reps add leads and start working them, the dashboard will fill in with approvals, top performers, and live activity."
            cta={{ label: "Open Sales hub", href: "/sales" }}
            secondaryCta={{ label: "Add a rep", href: "/sales/reps" }}
          />
        </DashboardSection>
      )}
    </DashboardPage>
  );
}

function RailCard({
  icon: Icon,
  title,
  subtitle,
  tone = "brand",
  children,
}: {
  icon: typeof Inbox;
  title: string;
  subtitle?: string;
  tone?: "brand" | "warn" | "neutral";
  children: React.ReactNode;
}) {
  const iconCls =
    tone === "warn"
      ? "bg-warn-soft text-gtn-amber"
      : tone === "neutral"
      ? "bg-surface-3 text-ink-muted"
      : "bg-brand-soft text-gtn-purple";
  return (
    <section className="rounded-xl bg-surface border border-line-subtle p-4">
      <header className="flex items-center gap-2.5 mb-3">
        <span aria-hidden className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${iconCls}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink-strong leading-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-ink-muted mt-0.5">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

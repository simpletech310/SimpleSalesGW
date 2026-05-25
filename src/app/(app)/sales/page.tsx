import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Users,
  MapPin,
  UserPlus,
  Inbox,
  DollarSign,
  Activity as ActivityIcon,
  Trophy,
  ChevronRight,
} from "lucide-react";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { DashboardPage, DashboardSection } from "@/components/templates";
import { DetailSplit } from "@/components/templates/DetailPage";
import { loadNotifications } from "@/lib/notifications";
import { PipelineStage, Role } from "@prisma/client";

/**
 * v3.1 — /sales hub, enriched.
 *
 * Was: 4 nav StatCards and nothing else.
 * Now: same nav strip on top, then a two-column split with the pending
 * pricing-approvals queue + recent rep activity on the main side, and
 * a top-reps mini-leaderboard on the rail.
 */
export default async function SalesHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "team:manage")) redirect("/");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    teamCount,
    territoryCount,
    repCount,
    unassignedCount,
    notifications,
    teamActivity,
    activeReps,
    closedWonPerRep,
  ] = await Promise.all([
    prisma.salesTeam.count({ where: { active: true } }),
    prisma.salesTerritory.count({ where: { active: true } }),
    prisma.user.count({ where: { active: true, role: Role.SALESPERSON } }),
    prisma.lead.count({ where: { teamId: null } }),
    loadNotifications({ id: session.user.id, role: session.user.role }),
    prisma.activity.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        lead: { select: { id: true, businessName: true } },
        actor: { select: { id: true, name: true, role: true } },
      },
      take: 6,
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
    }),
    prisma.lead.groupBy({
      by: ["ownerUserId"],
      where: {
        pipelineStage: PipelineStage.CLOSED_WON,
        actualCloseDate: { gte: startOfMonth },
      },
      _count: { _all: true },
    }),
  ]);

  const managerApprovals = notifications.pricingApprovalsPending.filter((p) => p.tier === "MANAGER");
  const closedWonMap = new Map(closedWonPerRep.map((r) => [r.ownerUserId, r._count._all]));
  const repsRanked = [...activeReps]
    .map((r) => ({
      id: r.id,
      name: r.name,
      activeCount: r._count.ownedLeads,
      closedWon: closedWonMap.get(r.id) ?? 0,
    }))
    .sort((a, b) => b.activeCount - a.activeCount || b.closedWon - a.closedWon)
    .slice(0, 5);

  return (
    <DashboardPage
      eyebrow="Sales management"
      title="Sales hub"
      subtitle="Create teams scoped by service, draw geographic territories, hire reps, and assign leads. Each lead the system imports auto-matches to a territory based on the address; you can override any assignment here."
      kpis={
        <>
          <StatCard
            label="Teams"
            value={teamCount}
            icon={Users}
            tone="brand"
            href="/sales/teams"
            sub="Active teams grouped by service"
          />
          <StatCard
            label="Territories"
            value={territoryCount}
            icon={MapPin}
            tone="brand"
            href="/sales/territories"
            sub="Zip / city / state / polygon"
          />
          <StatCard
            label="Reps"
            value={repCount}
            icon={UserPlus}
            tone="brand"
            href="/sales/reps"
            sub="Active salespeople"
          />
          <StatCard
            label="Unassigned leads"
            value={unassignedCount}
            icon={Inbox}
            tone={unassignedCount > 0 ? "warn" : "success"}
            href="/sales/assign"
            sub={unassignedCount > 0 ? "Waiting for a team" : "All assigned"}
          />
        </>
      }
    >
      <DetailSplit
        asideWidth="340px"
        main={
          <>
            {/* Pending approvals queue */}
            <DashboardSection
              title="Pending pricing approvals"
              subtitle="5–20% off MRR — your tier to decide."
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
                  Inbox zero — no pricing requests waiting on you.
                </p>
              ) : (
                <ul className="divide-y divide-line-subtle">
                  {managerApprovals.slice(0, 5).map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/leads/${p.leadId}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-surface-3/50 transition-colors group"
                      >
                        <span
                          aria-hidden
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-warn-soft text-gtn-amber flex-shrink-0"
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                        </span>
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
              title="Recent rep activity"
              subtitle="Latest engagements across every salesperson."
              flush
            >
              {teamActivity.length === 0 ? (
                <p className="px-5 py-6 text-sm text-ink-muted text-center">
                  No activity yet across the team.
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
          <section className="rounded-xl bg-surface border border-line-subtle p-4">
            <header className="flex items-center gap-2.5 mb-3">
              <span
                aria-hidden
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-soft text-gtn-purple"
              >
                <Trophy className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-ink-strong leading-tight">Top reps</h3>
                <p className="text-[11px] text-ink-muted mt-0.5">By active leads · won-this-month tiebreak.</p>
              </div>
            </header>
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
                          i === 0 ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink-strong group-hover:text-gtn-purple transition-colors truncate">
                          {r.name}
                        </p>
                        <p className="text-[11px] text-ink-muted tabular">
                          {r.activeCount} active
                          {r.closedWon > 0 && <span className="text-gtn-green font-semibold"> · {r.closedWon} won</span>}
                        </p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-ink-faint group-hover:text-gtn-purple transition-colors flex-shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        }
      />
    </DashboardPage>
  );
}

import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  Inbox,
  Users,
  Target,
  TrendingUp,
  Plus,
  Trophy,
  Activity as ActivityIcon,
  CalendarClock,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, ScoreBadge } from "@/components/ui/Badge";
import { PipelineStrip } from "@/components/pipeline/PipelineStrip";
import { MiniBars, ConversionFunnel } from "@/components/ui/Charts";
import { STRINGS } from "@/lib/strings";
import { EmptyState } from "@/components/help/EmptyState";
import { DashboardPage, DashboardSection } from "@/components/templates";
import { DetailSplit } from "@/components/templates/DetailPage";
import { leadVisibilityFilter } from "@/lib/rbac";
import { PipelineStage, type Role } from "@prisma/client";

/**
 * v3.0.5 — Salesperson home, now a real sales dashboard.
 *
 * Sections (top to bottom):
 *   - 4 KPI stat cards (all leads / active / late stage / closed-won-this-month)
 *   - Pipeline board (drag-between-stages, full board)
 *   - Two-column split:
 *       MAIN  — Top opportunities (highest deal-quality, active only)
 *       ASIDE — This week's next-actions + Stale leads (7+ days no touch)
 *
 * Used by SALESPERSON (own leads), SALES_MANAGER (team), and SUPERADMIN
 * (everything) — the visibility filter scopes the same query for all.
 */
export async function SalespersonHome({
  user,
}: {
  user: { id: string; name: string | null; role: Role };
}) {
  const visibility = leadVisibilityFilter(user.role, user.id);
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  // First day of the month 5 months back → 6-month trend window.
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  // One query for the pipeline board + top opps + stale + counts.
  const [leads, openActions, recentActivity, closedWonThisMonth, closedWonTrend] = await Promise.all([
    prisma.lead.findMany({
      where: visibility,
      orderBy: [{ pipelineStage: "asc" }, { dealQualityScore: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        businessName: true,
        industry: true,
        pipelineStage: true,
        dealQualityScore: true,
        servicesScore: true,
        customerScore: true,
        nonStrategicFlag: true,
        primaryContactName: true,
        seatCount: true,
        updatedAt: true,
      },
    }),
    prisma.activity.findMany({
      where: {
        actorUserId: user.id,
        nextActionCompleted: false,
        nextActionDueAt: { lte: sevenDaysAhead },
      },
      orderBy: { nextActionDueAt: "asc" },
      include: { lead: { select: { id: true, businessName: true } } },
      take: 6,
    }),
    prisma.activity.findMany({
      where: { lead: visibility },
      orderBy: { createdAt: "desc" },
      include: {
        lead: { select: { id: true, businessName: true } },
        actor: { select: { name: true } },
      },
      take: 6,
    }),
    prisma.lead.count({
      where: {
        ...visibility,
        pipelineStage: PipelineStage.CLOSED_WON,
        actualCloseDate: { gte: startOfMonth },
      },
    }),
    // v3.7 — closed-won across the last 6 months for the momentum trend.
    prisma.lead.findMany({
      where: {
        ...visibility,
        pipelineStage: PipelineStage.CLOSED_WON,
        actualCloseDate: { gte: sixMonthsAgo },
      },
      select: { actualCloseDate: true },
    }),
  ]);

  const activeStages: PipelineStage[] = [
    PipelineStage.LEAD,
    PipelineStage.QUALIFIED,
    PipelineStage.FIRST_INTERACTION,
    PipelineStage.SITE_SURVEY_SCHEDULED,
    PipelineStage.DISCOVERY,
    PipelineStage.QUOTE_IN_PROGRESS,
    PipelineStage.QUOTE_SENT,
    PipelineStage.NEGOTIATION,
  ];
  const active = leads.filter((l) => activeStages.includes(l.pipelineStage));
  const lateStage = leads.filter(
    (l) =>
      l.pipelineStage === PipelineStage.QUOTE_SENT ||
      l.pipelineStage === PipelineStage.NEGOTIATION,
  );

  const stageCounts: Partial<Record<PipelineStage, number>> = {};
  for (const l of leads) {
    stageCounts[l.pipelineStage] = (stageCounts[l.pipelineStage] ?? 0) + 1;
  }

  // Top opportunities: highest deal-quality among active, capped at 5.
  const topOpps = [...active]
    .sort((a, b) => b.dealQualityScore - a.dealQualityScore)
    .slice(0, 5);

  // Stale: active leads not touched in 7+ days.
  const stale = active
    .filter((l) => new Date(l.updatedAt).getTime() < sevenDaysAgo.getTime())
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
    .slice(0, 5);

  // 6-month closed-won trend, bucketed by calendar month (oldest → newest).
  const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyWon = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTH_LABELS[d.getMonth()]!, value: 0 };
  });
  const monthIndex = new Map(monthlyWon.map((m, i) => [m.key, i]));
  for (const l of closedWonTrend) {
    if (!l.actualCloseDate) continue;
    const d = new Date(l.actualCloseDate);
    const idx = monthIndex.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (idx != null) monthlyWon[idx]!.value += 1;
  }
  const wonLast6 = monthlyWon.reduce((s, m) => s + m.value, 0);

  // Personal conversion funnel — LEAD → CLOSED_WON from this rep's own book.
  const funnelOrder: PipelineStage[] = [
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
  const funnelStages = funnelOrder.map((s) => ({
    label: STRINGS.pipeline.stages[s] ?? s.replace(/_/g, " "),
    count: stageCounts[s] ?? 0,
    href: `/pipeline?stage=${s}`,
    terminal: s === PipelineStage.CLOSED_WON,
  }));

  const firstName = user.name?.split(" ")[0] ?? "there";

  return (
    <DashboardPage
      eyebrow="Sales dashboard"
      title={`Welcome back, ${firstName}`}
      subtitle="Your pipeline at a glance. Use the buttons on each card to dive in."
      actions={
        <Button asChild size="sm">
          <Link href="/leads/new" className="inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            New lead
          </Link>
        </Button>
      }
      kpis={
        <>
          <StatCard label="All leads"           value={leads.length}        icon={Users}      tone="brand"   href="/leads" />
          <StatCard label="Active in pipeline"  value={active.length}       icon={Target}     tone="brand"   href="/pipeline" />
          <StatCard label="Late stage"          value={lateStage.length}    icon={TrendingUp} tone="warn"    href="/pipeline" sub={lateStage.length > 0 ? "Quote Sent + Negotiation" : "—"} />
          <StatCard label="Closed won this mo." value={closedWonThisMonth}  icon={Trophy}     tone="success" sub={closedWonThisMonth > 0 ? "🎉 Nice work" : "Let's get one"} />
        </>
      }
    >
      {leads.length === 0 ? (
        <DashboardSection>
          <EmptyState
            Icon={Inbox}
            title="No leads yet"
            body="Add your first lead and the portal scores it the moment you save. From there you'll see the deal-quality, services-fit and customer-fit scores update as you fill in more info."
            cta={{ label: "Add a lead", href: "/leads/new" }}
            secondaryCta={{ label: "Open help center", href: "/help" }}
          />
        </DashboardSection>
      ) : (
        <>
          {/* Compact pipeline strip — full kanban lives at /pipeline */}
          <PipelineStrip counts={stageCounts} heading="Your pipeline" />

          {/* v3.7 — momentum trend + personal conversion funnel */}
          <div className="grid lg:grid-cols-2 gap-4">
            <section className="rounded-xl bg-surface border border-line-subtle p-4">
              <header className="flex items-baseline justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink-strong">Your momentum</h3>
                  <p className="text-[11px] text-ink-muted">Closed-won deals, last 6 months.</p>
                </div>
                <span className="text-xs font-mono font-bold text-gtn-purple tabular">{wonLast6} won</span>
              </header>
              <MiniBars data={monthlyWon.map((m) => ({ label: m.label, value: m.value }))} />
            </section>

            <section className="rounded-xl bg-surface border border-line-subtle p-4">
              <header className="mb-3">
                <h3 className="text-sm font-semibold text-ink-strong">Conversion funnel</h3>
                <p className="text-[11px] text-ink-muted">Where your own deals sit, and pass-through between stages.</p>
              </header>
              <ConversionFunnel stages={funnelStages} />
            </section>
          </div>

          {/* Two-column split: top opps + recent activity (main); next-actions + stale (aside) */}
          <DetailSplit
            asideWidth="340px"
            main={
              <>
                {/* Top opportunities */}
                <DashboardSection
                  title="Top opportunities"
                  subtitle="Highest deal-quality scores in your active pipeline."
                  actions={
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/leads">All leads →</Link>
                    </Button>
                  }
                  flush
                >
                  {topOpps.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-ink-muted text-center">
                      No active opportunities right now.
                    </p>
                  ) : (
                    <ul className="divide-y divide-line-subtle">
                      {topOpps.map((l) => (
                        <li key={l.id}>
                          <Link
                            href={`/leads/${l.id}`}
                            className="flex items-center gap-3 px-5 py-3 hover:bg-surface-3/50 transition-colors group"
                          >
                            <ScoreBadge score={l.dealQualityScore} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-ink-strong group-hover:text-gtn-purple transition-colors truncate">
                                {l.businessName}
                              </p>
                              <p className="text-xs text-ink-muted truncate">
                                <span className="capitalize">{l.industry.replace(/_/g, " ").toLowerCase()}</span>
                                {l.seatCount ? <> · {l.seatCount} seats</> : null}
                                {l.primaryContactName ? <> · {l.primaryContactName}</> : null}
                              </p>
                            </div>
                            <Badge tone="brand" shape="pill" size="xs">
                              {l.pipelineStage.replace(/_/g, " ").toLowerCase()}
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-ink-faint flex-shrink-0 group-hover:text-ink transition-colors" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </DashboardSection>

                {/* Recent activity */}
                <DashboardSection
                  title="Recent activity"
                  subtitle="Latest engagements across your leads."
                  flush
                >
                  {recentActivity.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-ink-muted text-center">
                      No activity logged yet. Once you start calling, emailing, or meeting leads, it&apos;ll show up here.
                    </p>
                  ) : (
                    <ul className="divide-y divide-line-subtle">
                      {recentActivity.map((a) => (
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
                                {a.actor?.name && <> · {a.actor.name}</>}
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
                {/* This week's next-actions */}
                <RailCard icon={CalendarClock} title="This week" subtitle="Open next-actions due in 7 days.">
                  {openActions.length === 0 ? (
                    <p className="text-sm text-ink-muted">Nothing on the calendar.</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {openActions.map((a) => {
                        const isOverdue = a.nextActionDueAt && new Date(a.nextActionDueAt).getTime() < now.getTime();
                        return (
                          <li key={a.id} className="flex items-start justify-between gap-2 text-sm">
                            <div className="min-w-0 flex-1">
                              <Link
                                href={`/leads/${a.lead.id}`}
                                className="text-ink-strong font-medium hover:text-gtn-purple transition-colors block truncate"
                              >
                                {a.lead.businessName}
                              </Link>
                              {a.nextAction && (
                                <p className="text-xs text-ink-muted truncate">{a.nextAction}</p>
                              )}
                            </div>
                            <span
                              className={`text-[11px] flex-shrink-0 whitespace-nowrap font-semibold tabular ${
                                isOverdue ? "text-danger" : "text-ink-muted"
                              }`}
                            >
                              {a.nextActionDueAt ? format(new Date(a.nextActionDueAt), "MMM d") : "—"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </RailCard>

                {/* Stale leads */}
                <RailCard
                  icon={AlertTriangle}
                  title="Going stale"
                  subtitle="Active leads with no touch in 7+ days."
                  tone={stale.length > 0 ? "warn" : "neutral"}
                >
                  {stale.length === 0 ? (
                    <p className="text-sm text-ink-muted">All active leads touched recently. 🙌</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {stale.map((l) => (
                        <li key={l.id} className="flex items-start justify-between gap-2 text-sm">
                          <Link
                            href={`/leads/${l.id}`}
                            className="text-ink-strong font-medium hover:text-gtn-purple transition-colors min-w-0 truncate"
                          >
                            {l.businessName}
                          </Link>
                          <span className="text-[11px] flex-shrink-0 whitespace-nowrap text-warn font-semibold">
                            {formatDistanceToNow(new Date(l.updatedAt))} ago
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </RailCard>
              </>
            }
          />
        </>
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

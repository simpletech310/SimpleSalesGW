import Link from "next/link";
import {
  Briefcase,
  CalendarClock,
  ClipboardList,
  Compass,
  AlertTriangle,
  Activity as ActivityIcon,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { AutoRefresh } from "./AutoRefresh";
import { format, formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/help/EmptyState";
import { PipelineStrip } from "@/components/pipeline/PipelineStrip";
import { SegmentDonut, ProgressRing, CHART_COLORS } from "@/components/ui/Charts";
import { DashboardPage, DashboardSection } from "@/components/templates";
import { DetailSplit } from "@/components/templates/DetailPage";
import { customerVisibilityFilter, leadVisibilityFilter, VCIO_VISIBLE_STAGES } from "@/lib/rbac";
import { loadNotifications } from "@/lib/notifications";
import {
  CustomerStatus,
  DiscoveryStatus,
  OnboardingPhase,
  OnboardingTaskStatus,
  PipelineStage,
  type Role,
} from "@prisma/client";

/**
 * v3.1 — VcioHome elevated.
 *
 * Was: KPIs + portfolio + 3 rail cards.
 * Now adds: at-risk accounts (low onboarding progress after 30+ days OR
 * no QBR in 90+ days) AND a combined discovery + QBR activity feed for
 * the last 14 days. KPIs got sub-labels.
 *
 * No pipeline board, no +New lead, no pricing approvals.
 */
export async function VcioHome({
  user,
}: {
  user: { id: string; name: string | null; role: Role };
}) {
  const firstName = user.name?.split(" ")[0] ?? "there";
  const now = Date.now();
  const fourteenDaysOut = new Date(now + 14 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);
  const visibility = customerVisibilityFilter(user.role, user.id);
  const leadVisibility = leadVisibilityFilter(user.role, user.id);
  const [pipelineCountsRows, siteSurveysAwaiting] = await Promise.all([
    prisma.lead.groupBy({
      by: ["pipelineStage"],
      where: leadVisibility,
      _count: { _all: true },
    }),
    prisma.siteSurvey.count({ where: { status: "AWAITING_VCIO_ACCEPT" } }),
  ]);
  const pipelineCounts: Partial<Record<PipelineStage, number>> = Object.fromEntries(
    pipelineCountsRows.map((r) => [r.pipelineStage, r._count._all]),
  );

  const [
    customers,
    notifications,
    activeDiscoveries,
    upcomingQbrCount,
    overdueTaskCount,
    qbrsThisWeek,
    healthScan,
    recentDiscoveryCompletions,
    recentQbrCompletions,
  ] = await Promise.all([
    prisma.customer.findMany({
      where: {
        ...visibility,
        status: { in: [CustomerStatus.ONBOARDING, CustomerStatus.ACTIVE] },
      },
      include: {
        lead: { select: { businessName: true, industry: true } },
        accountManager: { select: { name: true } },
        _count: { select: { onboardingTasks: true, qbrs: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    loadNotifications({ id: user.id, role: user.role }),
    prisma.discoveryAssessment.findMany({
      where: { status: DiscoveryStatus.IN_PROGRESS, customerId: { not: null } },
      include: { customer: { select: { id: true, lead: { select: { businessName: true } } } } },
      orderBy: { startedAt: "desc" },
      take: 6,
    }),
    prisma.qbr.count({
      where: { scheduledAt: { gte: new Date(now), lte: fourteenDaysOut }, completedAt: null },
    }),
    prisma.onboardingTask.count({
      where: {
        status: { in: [OnboardingTaskStatus.PENDING, OnboardingTaskStatus.IN_PROGRESS] },
        dueAt: { lt: new Date(now) },
      },
    }),
    prisma.qbr.count({
      where: {
        scheduledAt: { gte: new Date(now), lte: new Date(now + 7 * 24 * 60 * 60 * 1000) },
        completedAt: null,
      },
    }),
    // For at-risk: pull all active customers with full task list + qbrs to compute health.
    prisma.customer.findMany({
      where: {
        ...visibility,
        status: { in: [CustomerStatus.ONBOARDING, CustomerStatus.ACTIVE] },
      },
      include: {
        lead: { select: { businessName: true } },
        onboardingTasks: { select: { status: true } },
        qbrs: { orderBy: { scheduledAt: "desc" }, take: 1, select: { scheduledAt: true, completedAt: true } },
      },
    }),
    prisma.discoveryAssessment.findMany({
      where: {
        status: DiscoveryStatus.COMPLETED,
        completedAt: { gte: fourteenDaysAgo },
        customerId: { not: null },
      },
      include: {
        customer: { select: { id: true, lead: { select: { businessName: true } } } },
        createdBy: { select: { name: true } },
      },
      orderBy: { completedAt: "desc" },
      take: 6,
    }),
    prisma.qbr.findMany({
      where: {
        completedAt: { gte: fourteenDaysAgo, not: null },
      },
      include: { customer: { select: { id: true, lead: { select: { businessName: true } } } } },
      orderBy: { completedAt: "desc" },
      take: 6,
    }),
  ]);

  const totalCustomers = customers.length;
  const onboarding = customers.filter((c) => c.status === CustomerStatus.ONBOARDING).length;
  const steady = customers.filter((c) => c.status === CustomerStatus.ACTIVE).length;

  // v3.7 — onboarding completion % per customer (from full task statuses on
  // healthScan), plus the book-wide mix + average onboarding progress.
  const progressByCustomer = new Map<string, number>();
  for (const c of healthScan) {
    const total = c.onboardingTasks.length;
    const done = c.onboardingTasks.filter((t) => t.status === "DONE" || t.status === "SKIPPED").length;
    progressByCustomer.set(c.id, total === 0 ? 0 : Math.round((done / total) * 100));
  }
  const bookOnboarding = healthScan.filter((c) => c.status === CustomerStatus.ONBOARDING);
  const bookSteady = healthScan.filter((c) => c.status === CustomerStatus.ACTIVE);
  const avgOnboardingPct =
    bookOnboarding.length > 0
      ? Math.round(
          bookOnboarding.reduce((s, c) => s + (progressByCustomer.get(c.id) ?? 0), 0) / bookOnboarding.length,
        )
      : 0;

  // At-risk computation: stuck in ONBOARDING with <50% task completion after
  // 30 days, OR no QBR completed in 90+ days. Both = clear vCIO action item.
  type AtRisk = {
    id: string;
    name: string;
    reason: string;
    severity: "warn" | "danger";
  };
  const atRiskAccounts: AtRisk[] = [];
  for (const c of healthScan) {
    const total = c.onboardingTasks.length;
    const done = c.onboardingTasks.filter((t) => t.status === "DONE" || t.status === "SKIPPED").length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    const ageMs = now - new Date(c.createdAt).getTime();
    const stuckInOnboarding =
      c.status === CustomerStatus.ONBOARDING && ageMs > 30 * 24 * 60 * 60 * 1000 && pct < 50;
    const lastQbr = c.qbrs[0]?.completedAt ? new Date(c.qbrs[0].completedAt).getTime() : null;
    const qbrStale = c.status === CustomerStatus.ACTIVE && (!lastQbr || lastQbr < ninetyDaysAgo.getTime());
    if (stuckInOnboarding) {
      atRiskAccounts.push({
        id: c.id,
        name: c.lead.businessName,
        reason: `Onboarding ${pct}% complete after ${Math.round(ageMs / (24 * 60 * 60 * 1000))} days`,
        severity: "danger",
      });
    } else if (qbrStale) {
      atRiskAccounts.push({
        id: c.id,
        name: c.lead.businessName,
        reason: lastQbr
          ? `Last QBR ${formatDistanceToNow(new Date(lastQbr))} ago`
          : "No QBR completed yet",
        severity: "warn",
      });
    }
  }
  // Show only top 5; sort danger first.
  atRiskAccounts.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "danger" ? -1 : 1,
  );
  const atRiskTop = atRiskAccounts.slice(0, 5);

  // Merge discovery + QBR completions into a single recent-activity feed.
  type FeedItem = {
    id: string;
    kind: "discovery" | "qbr";
    customerId: string;
    customerName: string;
    title: string;
    actor?: string;
    when: Date;
  };
  const feed: FeedItem[] = [
    ...recentDiscoveryCompletions
      .filter((d) => d.customer && d.completedAt)
      .map<FeedItem>((d) => ({
        id: `d-${d.id}`,
        kind: "discovery",
        customerId: d.customer!.id,
        customerName: d.customer!.lead.businessName,
        title: `${d.kind.replace(/_/g, " ").toLowerCase()} discovery completed`,
        actor: d.createdBy?.name,
        when: new Date(d.completedAt!),
      })),
    ...recentQbrCompletions
      .filter((q) => q.customer && q.completedAt)
      .map<FeedItem>((q) => ({
        id: `q-${q.id}`,
        kind: "qbr",
        customerId: q.customer!.id,
        customerName: q.customer!.lead.businessName,
        title: "QBR completed",
        when: new Date(q.completedAt!),
      })),
  ]
    .sort((a, b) => b.when.getTime() - a.when.getTime())
    .slice(0, 8);

  return (
    <DashboardPage
      eyebrow="vCIO portfolio"
      title={`Welcome back, ${firstName}`}
      subtitle="Drive discovery, run QBRs, and keep the strategic roadmap moving."
      actions={
        <>
          <Button asChild variant="secondary" size="sm">
            <Link href="/my-tasks">My tasks</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/accounts">Open accounts</Link>
          </Button>
        </>
      }
      kpis={
        <>
          <StatCard label="Active accounts" value={totalCustomers}     icon={Briefcase}     tone="brand"   href="/accounts" sub={totalCustomers > 0 ? "Onboarding + steady" : "Customer book is empty"} />
          <StatCard label="Onboarding"      value={onboarding}         icon={ClipboardList} tone="warn"    href="/accounts" sub={onboarding > 0 ? "Driving to steady-state" : "All caught up"} />
          <StatCard label="Steady state"    value={steady}             icon={Compass}       tone="success" href="/accounts" sub={steady > 0 ? "Customers on QBR cadence" : "—"} />
          <StatCard label="QBRs / 14d"      value={upcomingQbrCount}   icon={CalendarClock} tone="neutral" sub={qbrsThisWeek > 0 ? `${qbrsThisWeek} this week` : "Nothing this week"} />
        </>
      }
    >
      <AutoRefresh intervalMs={30000} />

      <PipelineStrip counts={pipelineCounts} stages={VCIO_VISIBLE_STAGES} heading="Pipeline in your scope" />

      {healthScan.length > 0 && (
        <DashboardSection
          title="Portfolio health"
          subtitle="Your active book at a glance — onboarding vs steady-state, average onboarding progress, and accounts needing attention."
        >
          <div className="flex flex-wrap items-center gap-x-10 gap-y-6">
            <SegmentDonut
              size={132}
              centerLabel={healthScan.length}
              centerSub="accounts"
              segments={[
                { value: bookOnboarding.length, color: CHART_COLORS.amber, label: "Onboarding" },
                { value: bookSteady.length, color: CHART_COLORS.green, label: "Steady state" },
              ]}
            />
            <div className="flex items-center gap-3">
              <ProgressRing value={avgOnboardingPct} size={84} color={CHART_COLORS.brand} />
              <div className="text-sm">
                <p className="font-semibold text-ink-strong">Avg onboarding</p>
                <p className="text-xs text-ink-muted max-w-[170px]">
                  Mean task completion across {bookOnboarding.length} onboarding account
                  {bookOnboarding.length === 1 ? "" : "s"}.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center justify-center w-[84px] h-[84px] rounded-full ${
                  atRiskAccounts.length > 0 ? "bg-warn-soft" : "bg-success-soft"
                }`}
                aria-hidden
              >
                <span
                  className={`text-3xl font-mono font-bold ${
                    atRiskAccounts.length > 0 ? "text-gtn-amber" : "text-gtn-green"
                  }`}
                >
                  {atRiskAccounts.length}
                </span>
              </span>
              <div className="text-sm">
                <p className="font-semibold text-ink-strong">At-risk</p>
                <p className="text-xs text-ink-muted max-w-[170px]">Stuck in onboarding or overdue for a QBR.</p>
              </div>
            </div>
          </div>
        </DashboardSection>
      )}

      {siteSurveysAwaiting > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <ClipboardList className="h-5 w-5 text-amber-700 mt-0.5 flex-shrink-0" />
          <div className="text-sm flex-1">
            <p className="font-semibold text-amber-900">
              {siteSurveysAwaiting} site survey{siteSurveysAwaiting === 1 ? "" : "s"} awaiting your acceptance
            </p>
            <p className="text-amber-900/80">
              Reps have queued assessments for you. Review the POC, scope, and date — accept or reject with a reason.
            </p>
          </div>
          <Link
            href="/vcio/site-surveys"
            className="self-center px-3 py-1.5 rounded bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800"
          >
            Open queue
          </Link>
        </div>
      )}

      {notifications.preSaleAssessments.length > 0 && (
        <div className="rounded-xl border border-brand/40 bg-brand-soft px-4 py-3 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-gtn-purple mt-0.5 flex-shrink-0" />
          <div className="text-sm flex-1">
            <p className="font-semibold text-ink-strong">
              {notifications.preSaleAssessments.length} pre-sale scoping request
              {notifications.preSaleAssessments.length === 1 ? "" : "s"} awaiting you
            </p>
            <ul className="mt-1 space-y-0.5 text-ink-muted">
              {notifications.preSaleAssessments.slice(0, 3).map((a) => (
                <li key={a.id} className="truncate">
                  <Link
                    href={`/leads/${a.leadId}/discovery/${a.id}`}
                    className="text-gtn-purple hover:underline font-medium"
                  >
                    {a.leadName}
                  </Link>{" "}
                  · {a.kind.replace(/_/g, " ").toLowerCase()} · requested by {a.requestedByName}
                </li>
              ))}
              {notifications.preSaleAssessments.length > 3 && (
                <li>
                  <Link href="/notifications" className="text-gtn-purple hover:underline font-medium">
                    +{notifications.preSaleAssessments.length - 3} more in notifications →
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {overdueTaskCount > 0 && (
        <div className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warn mt-0.5 flex-shrink-0" />
          <div className="text-sm flex-1">
            <p className="font-semibold text-ink-strong">
              {overdueTaskCount} onboarding task{overdueTaskCount === 1 ? "" : "s"} past due
            </p>
            <p className="text-ink-muted">
              <Link href="/my-tasks" className="text-gtn-purple hover:underline font-medium">
                Open My tasks
              </Link>{" "}
              to triage.
            </p>
          </div>
        </div>
      )}

      <DetailSplit
        asideWidth="340px"
        main={
          <DashboardSection
            title="Your customer portfolio"
            subtitle="Recent and active customers."
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link href="/accounts">View all →</Link>
              </Button>
            }
          >
            {customers.length === 0 ? (
              <EmptyState
                Icon={Briefcase}
                title="No active customers yet"
                body="A customer appears here the moment a Sales-to-Ops handoff is accepted. Once it does, you take over Discovery, Inventory, QBRs, and the strategic roadmap."
                cta={{ label: "Browse all accounts", href: "/accounts" }}
              />
            ) : (
              <ul className="grid sm:grid-cols-2 gap-3">
                {customers.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/accounts/${c.id}`}
                      className="block rounded-xl border border-line-subtle bg-surface p-4 hover:border-line-strong hover:shadow-card transition-all duration-120 ease-smooth"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-semibold text-ink-strong truncate">
                          {c.lead.businessName}
                        </p>
                        <PhaseBadge phase={c.currentPhase} />
                      </div>
                      <p className="text-xs text-ink-muted">
                        {c.lead.industry.replace(/_/g, " ").toLowerCase()} ·{" "}
                        Manager: {c.accountManager?.name ?? "Unassigned"}
                      </p>
                      <div className="text-xs text-ink-faint mt-2 flex gap-2 tabular">
                        <span>{c._count.onboardingTasks} tasks</span>
                        <span aria-hidden>·</span>
                        <span>{c._count.qbrs} QBRs</span>
                      </div>
                      {c.status === CustomerStatus.ONBOARDING && (
                        <div className="mt-2.5">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="uppercase tracking-wide text-ink-faint">Onboarding</span>
                            <span className="font-mono font-semibold text-ink-strong tabular">
                              {progressByCustomer.get(c.id) ?? 0}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden" aria-hidden>
                            <div
                              className="h-full rounded-full bg-gtn-purple"
                              style={{ width: `${progressByCustomer.get(c.id) ?? 0}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DashboardSection>
        }
        aside={
          <>
            <RailCard icon={CalendarClock} title="QBRs next 30 days">
              {notifications.upcomingQbrs.length === 0 ? (
                <p className="text-sm text-ink-muted">Nothing scheduled.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {notifications.upcomingQbrs.slice(0, 5).map((q) => (
                    <li key={q.id} className="flex items-start justify-between gap-2">
                      <Link
                        href={`/accounts/${q.customerId}`}
                        className="text-ink-strong hover:text-gtn-purple truncate"
                      >
                        {q.customerName}
                      </Link>
                      <span className="text-xs text-ink-muted flex-shrink-0 tabular">
                        {format(new Date(q.scheduledAt), "MMM d")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </RailCard>

            <RailCard icon={Compass} title="Discoveries in progress">
              {activeDiscoveries.length === 0 ? (
                <p className="text-sm text-ink-muted">Nothing in progress. Start one from any account.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {activeDiscoveries
                    .filter((d) => d.customer != null)
                    .map((d) => (
                      <li key={d.id} className="flex items-start justify-between gap-2">
                        <Link
                          href={`/accounts/${d.customer!.id}`}
                          className="text-ink-strong hover:text-gtn-purple truncate"
                        >
                          {d.customer!.lead.businessName}
                        </Link>
                        <span className="text-xs text-ink-muted flex-shrink-0">
                          {d.kind.replace(/_/g, " ").toLowerCase()}
                          {d.startedAt && (
                            <> · {formatDistanceToNow(new Date(d.startedAt), { addSuffix: false })}</>
                          )}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </RailCard>

            <RailCard icon={ClipboardList} title="Onboarding tasks due">
              {notifications.overdueOnboarding.length === 0 ? (
                <p className="text-sm text-ink-muted">Caught up. Nice.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {notifications.overdueOnboarding.slice(0, 5).map((t) => (
                    <li key={t.taskId} className="flex items-start justify-between gap-2">
                      <span className="truncate min-w-0">
                        <Link
                          href={`/accounts/${t.customerId}`}
                          className="text-ink-strong hover:text-gtn-purple font-medium"
                        >
                          {t.customerName}
                        </Link>
                        <span className="text-xs text-ink-muted block truncate">{t.title}</span>
                      </span>
                      <span className="text-xs text-danger flex-shrink-0 font-semibold tabular">
                        {format(new Date(t.dueAt), "MMM d")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </RailCard>
          </>
        }
      />

      {/* At-risk + recent activity — second row split below the portfolio */}
      <DetailSplit
        asideWidth="340px"
        main={
          <DashboardSection
            title="Recent activity"
            subtitle="Discoveries and QBRs completed in the last 14 days."
            flush
          >
            {feed.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-muted text-center">
                Nothing completed in the last 14 days. Start a discovery from any account.
              </p>
            ) : (
              <ul className="divide-y divide-line-subtle">
                {feed.map((item) => (
                  <li key={item.id} className="px-5 py-3">
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 mt-0.5 ${
                          item.kind === "qbr"
                            ? "bg-success-soft text-gtn-green"
                            : "bg-brand-soft text-gtn-purple"
                        }`}
                      >
                        {item.kind === "qbr" ? (
                          <CalendarClock className="h-3.5 w-3.5" />
                        ) : (
                          <ActivityIcon className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink-strong">
                          <Link
                            href={`/accounts/${item.customerId}`}
                            className="font-semibold hover:text-gtn-purple transition-colors"
                          >
                            {item.customerName}
                          </Link>
                          <span className="text-ink-muted font-normal capitalize"> · {item.title}</span>
                        </p>
                        <p className="text-xs text-ink-muted mt-0.5">
                          {item.actor && <>{item.actor} · </>}
                          <span className="text-ink-faint">{formatDistanceToNow(item.when, { addSuffix: true })}</span>
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DashboardSection>
        }
        aside={
          <RailCard
            icon={ShieldAlert}
            title="At-risk accounts"
            tone={atRiskTop.length > 0 ? "warn" : "neutral"}
          >
            {atRiskTop.length === 0 ? (
              <p className="text-sm text-ink-muted">All clear. Onboarding on pace and QBRs are current.</p>
            ) : (
              <ul className="space-y-2.5">
                {atRiskTop.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/accounts/${a.id}`}
                        className="text-ink-strong font-medium hover:text-gtn-purple transition-colors truncate block"
                      >
                        {a.name}
                      </Link>
                      <p className="text-[11px] text-ink-muted leading-relaxed">{a.reason}</p>
                    </div>
                    <Badge
                      tone={a.severity}
                      shape="pill"
                      size="xs"
                      className="flex-shrink-0"
                    >
                      {a.severity === "danger" ? "blocked" : "stale"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </RailCard>
        }
      />
    </DashboardPage>
  );
}

function RailCard({
  icon: Icon,
  title,
  tone = "brand",
  children,
}: {
  icon: typeof Briefcase;
  title: string;
  tone?: "brand" | "warn" | "neutral";
  children: React.ReactNode;
}) {
  const iconCls =
    tone === "warn"
      ? "text-gtn-amber"
      : tone === "neutral"
      ? "text-ink-muted"
      : "text-gtn-purple";
  return (
    <section className="rounded-xl bg-surface border border-line-subtle p-4">
      <h3 className="text-sm font-semibold text-ink-strong flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${iconCls}`} aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  );
}

function PhaseBadge({ phase }: { phase: OnboardingPhase }) {
  return (
    <Badge tone="brand" shape="pill" size="xs">
      {phase.replace(/_/g, " ").toLowerCase()}
    </Badge>
  );
}

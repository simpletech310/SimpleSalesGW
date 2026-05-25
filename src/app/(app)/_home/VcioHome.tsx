import Link from "next/link";
import {
  Briefcase,
  CalendarClock,
  ClipboardList,
  Compass,
  AlertTriangle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/help/EmptyState";
import { DashboardPage, DashboardSection } from "@/components/templates";
import { DetailSplit } from "@/components/templates/DetailPage";
import { customerVisibilityFilter } from "@/lib/rbac";
import { loadNotifications } from "@/lib/notifications";
import {
  CustomerStatus,
  DiscoveryStatus,
  OnboardingPhase,
  OnboardingTaskStatus,
  type Role,
} from "@prisma/client";

/**
 * v3.0 — VcioHome on the unified DashboardPage template.
 *
 * vCIO portfolio view: KPI strip + customer portfolio (main column) +
 * three rail cards (QBRs, in-progress discoveries, overdue tasks).
 *
 * No pipeline board, no +New lead, no pricing approvals.
 */
export async function VcioHome({
  user,
}: {
  user: { id: string; name: string | null; role: Role };
}) {
  const firstName = user.name?.split(" ")[0] ?? "there";
  const fourteenDaysOut = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const [
    customers,
    notifications,
    activeDiscoveries,
    upcomingQbrCount,
    overdueTaskCount,
  ] = await Promise.all([
    prisma.customer.findMany({
      where: {
        ...customerVisibilityFilter(user.role, user.id),
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
      where: { scheduledAt: { gte: new Date(), lte: fourteenDaysOut }, completedAt: null },
    }),
    prisma.onboardingTask.count({
      where: {
        status: { in: [OnboardingTaskStatus.PENDING, OnboardingTaskStatus.IN_PROGRESS] },
        dueAt: { lt: new Date() },
      },
    }),
  ]);

  const totalCustomers = customers.length;
  const onboarding = customers.filter((c) => c.status === CustomerStatus.ONBOARDING).length;
  const steady = customers.filter((c) => c.status === CustomerStatus.ACTIVE).length;

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
          <StatCard label="Active accounts" value={totalCustomers}     icon={Briefcase}     tone="brand"   href="/accounts" />
          <StatCard label="Onboarding"      value={onboarding}         icon={ClipboardList} tone="warn"    href="/accounts" />
          <StatCard label="Steady state"    value={steady}             icon={Compass}       tone="success" href="/accounts" />
          <StatCard label="QBRs / 14d"      value={upcomingQbrCount}   icon={CalendarClock} tone="neutral" />
        </>
      }
    >
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
    </DashboardPage>
  );
}

function RailCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Briefcase;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-surface border border-line-subtle p-4">
      <h3 className="text-sm font-semibold text-ink-strong flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-gtn-purple" aria-hidden />
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

import Link from "next/link";
import { Briefcase, CalendarClock, ClipboardList, Compass, AlertTriangle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/help/EmptyState";
import { HeroBand } from "@/components/brand";
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
 * VcioHome — Teejay's landing.
 *
 * The vCIO doesn't qualify or close leads — they take over once a customer
 * exists. So their home is the post-handoff lifecycle: active customers,
 * upcoming QBRs, in-progress discoveries, and onboarding tasks coming due.
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
      where: { status: DiscoveryStatus.IN_PROGRESS },
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
    <div className="space-y-6">
      <HeroBand
        eyebrow="VCIO DASHBOARD"
        title={`Welcome back, ${firstName}`}
        subtitle="Your customer portfolio at a glance. Drive discovery, run QBRs, and keep the strategic roadmap moving."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/accounts">Open accounts</Link>
            </Button>
            <Button asChild>
              <Link href="/my-tasks">My tasks</Link>
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-4 gap-4 max-w-2xl">
          <Stat label="Active accounts" value={totalCustomers} />
          <Stat label="Onboarding" value={onboarding} />
          <Stat label="Steady state" value={steady} />
          <Stat label="QBRs / 14d" value={upcomingQbrCount} />
        </div>
      </HeroBand>

      {overdueTaskCount > 0 && (
        <div className="rounded-lg border border-gtn-amber/40 bg-[#FEF3E2] px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-gtn-amber mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-gtn-navy">
              {overdueTaskCount} onboarding task{overdueTaskCount === 1 ? "" : "s"} past due
            </p>
            <p className="text-gtn-grey-2">
              <Link href="/my-tasks" className="text-gtn-purple hover:underline">
                Open My tasks
              </Link>{" "}
              to triage.
            </p>
          </div>
        </div>
      )}

      {/* Two-column: customer portfolio + side-rail of due work */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Customer portfolio */}
        <div className="lg:col-span-2 space-y-3">
          <SectionHeading icon={Briefcase} title="Your customer portfolio" href="/accounts" />
          {customers.length === 0 ? (
            <EmptyState
              Icon={Briefcase}
              title="No active customers yet"
              body="A customer appears here the moment a Sales-to-Ops handoff is accepted. Once it does, you take over Discovery, Inventory, QBRs, and the strategic roadmap."
              cta={{ label: "Browse all accounts", href: "/accounts" }}
            />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {customers.map((c) => (
                <Link
                  key={c.id}
                  href={`/accounts/${c.id}`}
                  className="gtn-card hover:border-gtn-purple/40 hover:shadow-sm transition p-4 block"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-gtn-navy truncate">{c.lead.businessName}</p>
                    <PhaseBadge phase={c.currentPhase} />
                  </div>
                  <p className="text-xs text-gtn-grey-2">
                    {c.lead.industry.replace(/_/g, " ").toLowerCase()} ·{" "}
                    Manager: {c.accountManager?.name ?? "Unassigned"}
                  </p>
                  <div className="text-xs text-gtn-grey-3 mt-2 flex gap-3">
                    <span>{c._count.onboardingTasks} tasks</span>
                    <span>·</span>
                    <span>{c._count.qbrs} QBRs</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Side rail */}
        <div className="space-y-4">
          {/* Upcoming QBRs */}
          <Card>
            <SectionHeading icon={CalendarClock} title="QBRs next 30 days" />
            {notifications.upcomingQbrs.length === 0 ? (
              <p className="text-xs text-gtn-grey-2 mt-2">Nothing scheduled.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {notifications.upcomingQbrs.slice(0, 5).map((q) => (
                  <li key={q.id} className="flex items-start justify-between gap-2">
                    <Link
                      href={`/accounts/${q.customerId}`}
                      className="text-gtn-navy hover:text-gtn-purple truncate"
                    >
                      {q.customerName}
                    </Link>
                    <span className="text-xs text-gtn-grey-3 flex-shrink-0">
                      {format(new Date(q.scheduledAt), "MMM d")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* In-progress discoveries */}
          <Card>
            <SectionHeading icon={Compass} title="Discoveries in progress" />
            {activeDiscoveries.length === 0 ? (
              <p className="text-xs text-gtn-grey-2 mt-2">
                Nothing in progress. Start one from any account.
              </p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {activeDiscoveries.map((d) => (
                  <li key={d.id} className="flex items-start justify-between gap-2">
                    <Link
                      href={`/accounts/${d.customer.id}`}
                      className="text-gtn-navy hover:text-gtn-purple truncate"
                    >
                      {d.customer.lead.businessName}
                    </Link>
                    <span className="text-xs text-gtn-grey-3 flex-shrink-0">
                      {d.kind.replace(/_/g, " ").toLowerCase()} ·{" "}
                      {d.startedAt ? formatDistanceToNow(new Date(d.startedAt), { addSuffix: false }) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Tasks due in 14d */}
          <Card>
            <SectionHeading icon={ClipboardList} title="Onboarding tasks due" />
            {notifications.overdueOnboarding.length === 0 ? (
              <p className="text-xs text-gtn-grey-2 mt-2">Caught up. Nice.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {notifications.overdueOnboarding.slice(0, 5).map((t) => (
                  <li key={t.taskId} className="flex items-start justify-between gap-2">
                    <span className="truncate">
                      <Link href={`/accounts/${t.customerId}`} className="text-gtn-navy hover:text-gtn-purple">
                        {t.customerName}
                      </Link>
                      <span className="text-xs text-gtn-grey-3 block truncate">{t.title}</span>
                    </span>
                    <span className="text-xs text-gtn-red flex-shrink-0">
                      {format(new Date(t.dueAt), "MMM d")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="gtn-eyebrow">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  href,
}: {
  icon: typeof Briefcase;
  title: string;
  href?: string;
}) {
  const body = (
    <h2 className="text-sm font-semibold text-gtn-navy flex items-center gap-2">
      <Icon className="h-4 w-4 text-gtn-purple" />
      {title}
    </h2>
  );
  return href ? (
    <div className="flex items-center justify-between">
      {body}
      <Link href={href} className="text-xs text-gtn-purple hover:underline">
        View all →
      </Link>
    </div>
  ) : (
    body
  );
}

function PhaseBadge({ phase }: { phase: OnboardingPhase }) {
  const label = phase.replace(/_/g, " ").toLowerCase();
  return (
    <span className="text-[10px] uppercase tracking-wide bg-gtn-lavender text-gtn-purple rounded-full px-2 py-0.5">
      {label}
    </span>
  );
}

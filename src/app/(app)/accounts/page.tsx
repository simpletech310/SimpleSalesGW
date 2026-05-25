import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Briefcase, ClipboardList, Compass, CalendarClock, AlertTriangle } from "lucide-react";
import { CustomerStatus, OnboardingTaskStatus, Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { customerVisibilityFilter } from "@/lib/rbac";
import { EmptyState } from "@/components/help/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ListPage } from "@/components/templates";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // v3.0.5 — SALESPERSON has no business in the post-handoff accounts world.
  // That's the vCIO + COO surface. Send them back to the pipeline where
  // their live deals are.
  if (session.user.role === Role.SALESPERSON) redirect("/pipeline");

  const visibility = customerVisibilityFilter(session.user.role, session.user.id);
  const fourteenDaysOut = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const [customers, overdueTaskCount, upcomingQbrCount] = await Promise.all([
    prisma.customer.findMany({
      where: visibility,
      include: {
        lead: { select: { id: true, businessName: true, industry: true } },
        accountManager: { select: { name: true } },
        onboardingTasks: { select: { status: true } },
        qbrs: {
          orderBy: { scheduledAt: "desc" },
          take: 1,
          select: { scheduledAt: true, completedAt: true },
        },
        _count: { select: { onboardingTasks: true, qbrs: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.onboardingTask.count({
      where: {
        status: { in: [OnboardingTaskStatus.PENDING, OnboardingTaskStatus.IN_PROGRESS] },
        dueAt: { lt: new Date() },
      },
    }),
    prisma.qbr.count({
      where: { scheduledAt: { gte: new Date(), lte: fourteenDaysOut }, completedAt: null },
    }),
  ]);

  const onboardingCount = customers.filter((c) => c.status === CustomerStatus.ONBOARDING).length;
  const steadyCount = customers.filter((c) => c.status === CustomerStatus.ACTIVE).length;

  // Health signal per customer (preserved from v2.14)
  type Health = "green" | "amber" | "red";
  const now = Date.now();
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
  const ONE_TWENTY_DAYS = 120 * 24 * 60 * 60 * 1000;
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const healthByCustomer = new Map<string, { dot: Health; onboardingPct: number; daysSinceQbr: number | null }>();
  for (const c of customers) {
    const total = c.onboardingTasks.length;
    const done = c.onboardingTasks.filter((t) => t.status === "DONE" || t.status === "SKIPPED").length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    const lastQbr = c.qbrs[0]?.completedAt ?? null;
    const daysSinceQbr = lastQbr
      ? Math.floor((now - new Date(lastQbr).getTime()) / (24 * 60 * 60 * 1000))
      : null;
    const ageMs = now - new Date(c.createdAt).getTime();
    let dot: Health = "amber";
    if (pct >= 80 || (lastQbr && now - new Date(lastQbr).getTime() < NINETY_DAYS)) {
      dot = "green";
    } else if ((pct < 40 && ageMs > THIRTY_DAYS) || (lastQbr && now - new Date(lastQbr).getTime() > ONE_TWENTY_DAYS)) {
      dot = "red";
    }
    healthByCustomer.set(c.id, { dot, onboardingPct: pct, daysSinceQbr });
  }

  type AccountRow = (typeof customers)[number];
  const columns: Column<AccountRow>[] = [
    {
      key: "business",
      header: "Business",
      cell: (c) => (
        <div className="min-w-0">
          <Link href={`/accounts/${c.id}`} className="text-ink-strong font-medium hover:text-gtn-purple truncate block">
            {c.lead.businessName}
          </Link>
          <p className="text-xs text-ink-muted truncate">{c.lead.industry.replace(/_/g, " ").toLowerCase()}</p>
        </div>
      ),
    },
    {
      key: "health",
      header: "Health",
      align: "center",
      width: "84px",
      cell: (c) => {
        const h = healthByCustomer.get(c.id);
        const title = h
          ? `${h.onboardingPct}% onboarding · ${h.daysSinceQbr === null ? "no QBR yet" : `${h.daysSinceQbr}d since last QBR`}`
          : "";
        return <HealthDot dot={h?.dot ?? "amber"} title={title} />;
      },
    },
    {
      key: "status",
      header: "Status",
      hideOnMobile: true,
      cell: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: "phase",
      header: "Phase",
      hideOnMobile: true,
      cell: (c) => (
        <Badge tone="brand" shape="pill" size="xs">
          {c.currentPhase.replace(/_/g, " ").toLowerCase()}
        </Badge>
      ),
    },
    {
      key: "manager",
      header: "Account manager",
      hideOnMobile: true,
      cell: (c) => <span className="text-ink-muted">{c.accountManager?.name ?? "—"}</span>,
    },
    {
      key: "onboarding",
      header: "Onboarding",
      align: "right",
      numeric: true,
      cell: (c) => {
        const h = healthByCustomer.get(c.id);
        return (
          <span className="text-ink-muted">
            {h?.onboardingPct ?? 0}% · {c._count.onboardingTasks} tasks
          </span>
        );
      },
    },
    {
      key: "started",
      header: "Started",
      hideOnMobile: true,
      cell: (c) => (
        <span className="text-xs text-ink-faint">
          {c.onboardingStartedAt ? format(new Date(c.onboardingStartedAt), "PPP") : "—"}
        </span>
      ),
    },
  ];

  return (
    <ListPage
      title="Accounts"
      subtitle={
        <>
          {customers.length} {customers.length === 1 ? "customer" : "customers"} · post-handoff lifecycle
        </>
      }
      body={
        <div className="space-y-4">
          {/* v3.1.2 — KPI strip on the accounts list. Same StatCard primitive
              the role homes use; lets the vCIO triage workload before
              opening anyone. */}
          {customers.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <StatCard
                label="Total customers"
                value={customers.length}
                icon={Briefcase}
                tone="brand"
                sub="Active customer book"
              />
              <StatCard
                label="Onboarding"
                value={onboardingCount}
                icon={ClipboardList}
                tone={onboardingCount > 0 ? "warn" : "neutral"}
                sub={onboardingCount > 0 ? "Driving to steady-state" : "All graduated"}
              />
              <StatCard
                label="Steady state"
                value={steadyCount}
                icon={Compass}
                tone="success"
                sub={steadyCount > 0 ? "On QBR cadence" : "—"}
              />
              <StatCard
                label="QBRs / 14d"
                value={upcomingQbrCount}
                icon={CalendarClock}
                tone="neutral"
                sub={overdueTaskCount > 0 ? `⚠ ${overdueTaskCount} overdue task${overdueTaskCount === 1 ? "" : "s"}` : "Tasks on schedule"}
              />
            </div>
          )}

          {customers.length === 0 ? (
            <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
              <EmptyState
                Icon={Briefcase}
                title="No customers yet"
                body="An Account appears here the moment a Sales-to-Ops handoff is accepted. Once it does, the vCIO takes over Discovery, Inventory, QBRs, and the strategic roadmap."
                cta={{ label: "Open notifications", href: "/notifications" }}
                secondaryCta={{ label: "Open help center", href: "/help" }}
              />
            </div>
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={customers}
                getRowKey={(c) => c.id}
                getRowHref={(c) => `/accounts/${c.id}`}
                empty="No customers yet."
              />
              {overdueTaskCount > 0 && (
                <div className="rounded-xl border border-warn/30 bg-warn-soft/40 px-4 py-3 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warn mt-0.5 flex-shrink-0" />
                  <div className="text-sm flex-1">
                    <p className="font-semibold text-ink-strong">
                      {overdueTaskCount} onboarding task{overdueTaskCount === 1 ? "" : "s"} past due
                    </p>
                    <p className="text-ink-muted">
                      <Link href="/my-tasks" className="text-gtn-purple hover:underline font-medium">
                        Triage in My tasks →
                      </Link>
                    </p>
                  </div>
                </div>
              )}
              <p className="text-xs text-ink-muted">
                Looking for a customer that should be here? A Customer only appears after a Sales-to-Ops handoff
                has been accepted by the COO.{" "}
                <Link href="/leads" className="text-gtn-purple hover:underline font-medium">
                  See your closed-won leads →
                </Link>
              </p>
            </>
          )}
        </div>
      }
    />
  );
}

function HealthDot({ dot, title }: { dot: "green" | "amber" | "red"; title?: string }) {
  const cls =
    dot === "green" ? "bg-success" : dot === "red" ? "bg-danger" : "bg-warn";
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`}
      aria-label={`Health: ${dot}`}
      title={title}
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ACTIVE" ? "success" :
    status === "ONBOARDING" ? "warn" :
    status === "PAUSED" ? "neutral" :
    "danger";
  return (
    <Badge tone={tone} shape="pill" size="xs">
      {status.toLowerCase()}
    </Badge>
  );
}

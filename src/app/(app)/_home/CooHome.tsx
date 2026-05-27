import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowRightLeft,
  Briefcase,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Timer,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, ScoreBadge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/help/EmptyState";
import { PipelineStrip } from "@/components/pipeline/PipelineStrip";
import { DashboardPage, DashboardSection } from "@/components/templates";
import { DetailSplit } from "@/components/templates/DetailPage";
import { loadNotifications } from "@/lib/notifications";
import { CustomerStatus, HandoffStatus, PipelineStage, type Role } from "@prisma/client";

/**
 * v3.0 — CooHome on the unified DashboardPage template.
 *
 * Ops focus: handoff queue + 20%+ pricing approvals + active customers +
 * late-stage pipeline. Migrated from the legacy HeroBand layout to the
 * shared DashboardPage chrome.
 *
 * No +New lead, no salesperson-style pipeline board.
 */
export async function CooHome({
  user,
}: {
  user: { id: string; name: string | null; role: Role };
}) {
  const firstName = user.name?.split(" ")[0] ?? "there";
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [
    notifications,
    customerCount,
    lateStageLeads,
    recentCustomers,
    recentDecidedHandoffs,
    thisWeekHandoffActivity,
    pipelineCountsRows,
  ] = await Promise.all([
    loadNotifications({ id: user.id, role: user.role }),
    prisma.customer.count({
      where: { status: { in: [CustomerStatus.ONBOARDING, CustomerStatus.ACTIVE] } },
    }),
    prisma.lead.findMany({
      where: {
        pipelineStage: { in: [PipelineStage.QUOTE_SENT, PipelineStage.NEGOTIATION] },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        businessName: true,
        pipelineStage: true,
        dealQualityScore: true,
        owner: { select: { name: true } },
        updatedAt: true,
      },
    }),
    prisma.customer.findMany({
      where: { status: { in: [CustomerStatus.ONBOARDING, CustomerStatus.ACTIVE] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { lead: { select: { businessName: true } } },
    }),
    // Recent accepted/rejected handoffs for the activity feed.
    prisma.handoff.findMany({
      where: {
        status: { in: [HandoffStatus.ACCEPTED, HandoffStatus.REJECTED] },
        updatedAt: { gte: sevenDaysAgo },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: {
        lead: { select: { id: true, businessName: true } },
        acceptor: { select: { name: true } },
        initiator: { select: { name: true } },
      },
    }),
    // For the weekly throughput stat — count + avg turnaround.
    prisma.handoff.findMany({
      where: {
        status: { in: [HandoffStatus.ACCEPTED, HandoffStatus.REJECTED] },
        updatedAt: { gte: sevenDaysAgo },
      },
      select: { createdAt: true, updatedAt: true },
    }),
    prisma.lead.groupBy({ by: ["pipelineStage"], _count: { _all: true } }),
  ]);

  const pipelineCounts: Partial<Record<PipelineStage, number>> = Object.fromEntries(
    pipelineCountsRows.map((r) => [r.pipelineStage, r._count._all]),
  );

  const handoffs = notifications.handoffsAwaiting;
  const cooApprovals = notifications.pricingApprovalsPending.filter((p) => p.tier === "COO");

  // Weekly throughput: decided count + median turnaround (in hours).
  const turnaroundsMs = thisWeekHandoffActivity.map(
    (h) => h.updatedAt.getTime() - h.createdAt.getTime(),
  );
  turnaroundsMs.sort((a, b) => a - b);
  const medianTurnaroundMs =
    turnaroundsMs.length === 0
      ? 0
      : turnaroundsMs.length % 2 === 1
      ? turnaroundsMs[(turnaroundsMs.length - 1) / 2]!
      : ((turnaroundsMs[turnaroundsMs.length / 2 - 1]! + turnaroundsMs[turnaroundsMs.length / 2]!) / 2);
  const medianHours = Math.round(medianTurnaroundMs / (60 * 60 * 1000));

  type HandoffRow = (typeof handoffs)[number];
  const handoffColumns: Column<HandoffRow>[] = [
    {
      key: "lead",
      header: "Lead",
      cell: (h) => (
        <Link href={`/leads/${h.leadId}`} className="font-medium text-ink-strong hover:text-gtn-purple">
          {h.leadName}
        </Link>
      ),
    },
    {
      key: "initiator",
      header: "Initiator",
      hideOnMobile: true,
      cell: (h) => <span className="text-ink-muted">{h.initiatorName}</span>,
    },
    {
      key: "waiting",
      header: "Waiting",
      cell: (h) => (
        <span className="text-ink-muted">
          {formatDistanceToNow(new Date(h.initiatedAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: "action",
      header: "",
      align: "right",
      cell: () => (
        <Link href="/notifications" className="text-xs font-semibold text-gtn-purple hover:underline">
          Review & accept →
        </Link>
      ),
    },
  ];

  return (
    <DashboardPage
      eyebrow="Ops dashboard"
      title={`Welcome back, ${firstName}`}
      subtitle="Approve handoffs, sign off on the biggest discounts, and keep an eye on the customer book."
      actions={
        <>
          <Button asChild variant="secondary" size="sm">
            <Link href="/notifications">All notifications</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/accounts">Customer book</Link>
          </Button>
        </>
      }
      kpis={
        <>
          <StatCard
            label="Handoffs awaiting"
            value={handoffs.length}
            icon={ArrowRightLeft}
            tone={handoffs.length > 0 ? "warn" : "neutral"}
            href="/notifications"
            sub={handoffs.length > 0 ? "Review + accept to spawn accounts" : "Inbox zero on handoffs"}
          />
          <StatCard
            label="20%+ approvals"
            value={cooApprovals.length}
            icon={DollarSign}
            tone={cooApprovals.length > 0 ? "warn" : "neutral"}
            href="/notifications"
            sub={cooApprovals.length > 0 ? "Deep-discount queue" : "Nothing in your tier"}
          />
          <StatCard
            label="Active customers"
            value={customerCount}
            icon={Briefcase}
            tone="brand"
            href="/accounts"
            sub={customerCount > 0 ? "Onboarding + steady" : "—"}
          />
          <StatCard
            label="Late-stage leads"
            value={lateStageLeads.length}
            icon={TrendingUp}
            tone="neutral"
            href="/pipeline"
            sub={lateStageLeads.length > 0 ? "Quote Sent + Negotiation" : "—"}
          />
        </>
      }
    >
      <PipelineStrip counts={pipelineCounts} heading="Company pipeline" />

      <DashboardSection
        title="Handoffs awaiting your acceptance"
        subtitle="A salesperson handed a closed deal across — review and accept to spawn an Account."
        flush
      >
        <DataTable
          columns={handoffColumns}
          rows={handoffs}
          getRowKey={(h) => h.id}
          empty="No handoffs waiting. Nice and clean."
          density="default"
          className="border-0 rounded-none"
        />
      </DashboardSection>

      <DetailSplit
        asideWidth="340px"
        main={
          <DashboardSection
            title="Late-stage deals"
            subtitle="Quote sent and negotiation — keep an eye on these."
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link href="/pipeline">Open pipeline →</Link>
              </Button>
            }
          >
            {lateStageLeads.length === 0 ? (
              <p className="text-sm text-ink-muted">No deals in Proposal/Negotiation.</p>
            ) : (
              <ul className="divide-y divide-line-subtle -my-2">
                {lateStageLeads.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link
                        href={`/leads/${l.id}`}
                        className="text-ink-strong font-medium hover:text-gtn-purple truncate block"
                      >
                        {l.businessName}
                      </Link>
                      <span className="text-xs text-ink-muted">
                        {l.pipelineStage.replace(/_/g, " ").toLowerCase()} · {l.owner?.name ?? "—"}
                      </span>
                    </div>
                    <ScoreBadge score={l.dealQualityScore} />
                  </li>
                ))}
              </ul>
            )}
          </DashboardSection>
        }
        aside={
          <>
            <RailCard icon={DollarSign} title="Pricing approvals (20%+)">
              {cooApprovals.length === 0 ? (
                <p className="text-sm text-ink-muted">Nothing in your queue.</p>
              ) : (
                <ul className="space-y-2.5 text-sm">
                  {cooApprovals.slice(0, 5).map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/leads/${p.leadId}`}
                          className="text-ink-strong hover:text-gtn-purple truncate block font-medium"
                        >
                          {p.leadName}
                        </Link>
                        <span className="text-xs text-ink-muted tabular">
                          {p.discountPct}% off · ${p.proposedPrice.toLocaleString()}/mo
                          {p.belowFloor && (
                            <Badge tone="danger" shape="pill" size="xs" className="ml-1.5">below floor</Badge>
                          )}
                        </span>
                      </div>
                      <Link
                        href="/notifications"
                        className="text-xs font-semibold text-gtn-purple hover:underline flex-shrink-0"
                      >
                        Review →
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </RailCard>

            <RailCard icon={Briefcase} title="Newest customers">
              {recentCustomers.length === 0 ? (
                <p className="text-sm text-ink-muted">No customers yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {recentCustomers.map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-2">
                      <Link
                        href={`/accounts/${c.id}`}
                        className="text-ink-strong hover:text-gtn-purple truncate"
                      >
                        {c.lead.businessName}
                      </Link>
                      <span className="text-xs text-ink-muted flex-shrink-0 tabular">
                        {format(new Date(c.createdAt), "MMM d")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </RailCard>
          </>
        }
      />

      {/* Second-row split: recent decisions feed + weekly throughput stat */}
      <DetailSplit
        asideWidth="340px"
        main={
          <DashboardSection
            title="Recent handoff decisions"
            subtitle="Accepted or rejected in the last 7 days."
            flush
          >
            {recentDecidedHandoffs.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-muted text-center">
                No handoff decisions yet this week. They land here once you accept or reject one.
              </p>
            ) : (
              <ul className="divide-y divide-line-subtle">
                {recentDecidedHandoffs.map((h) => {
                  const accepted = h.status === HandoffStatus.ACCEPTED;
                  return (
                    <li key={h.id} className="px-5 py-3">
                      <div className="flex items-start gap-3">
                        <span
                          aria-hidden
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 mt-0.5 ${
                            accepted
                              ? "bg-success-soft text-gtn-green"
                              : "bg-danger-soft text-gtn-red"
                          }`}
                        >
                          {accepted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-ink-strong">
                            <Link
                              href={`/leads/${h.lead.id}`}
                              className="font-semibold hover:text-gtn-purple transition-colors"
                            >
                              {h.lead.businessName}
                            </Link>
                            <span className="text-ink-muted font-normal ml-1.5">
                              · {accepted ? "accepted" : "rejected"}
                              {h.acceptor?.name && <> by {h.acceptor.name}</>}
                            </span>
                          </p>
                          <p className="text-xs text-ink-muted mt-0.5">
                            initiated by {h.initiator?.name ?? "—"}
                            <span className="text-ink-faint"> · {formatDistanceToNow(new Date(h.updatedAt), { addSuffix: true })}</span>
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </DashboardSection>
        }
        aside={
          <RailCard icon={Timer} title="This week" subtitle="Handoff throughput, last 7 days.">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="ui-label">Decided</dt>
                <dd className="ui-stat text-2xl mt-1 tabular text-ink-strong">
                  {recentDecidedHandoffs.length}
                </dd>
                <p className="text-[11px] text-ink-muted mt-0.5">accepted + rejected</p>
              </div>
              <div>
                <dt className="ui-label">Median turnaround</dt>
                <dd className="ui-stat text-2xl mt-1 tabular text-ink-strong">
                  {medianHours > 0 ? `${medianHours}h` : "—"}
                </dd>
                <p className="text-[11px] text-ink-muted mt-0.5">initiate → decide</p>
              </div>
            </dl>
            {handoffs.length > 0 && (
              <p className="text-xs text-warn font-semibold mt-3 pt-3 border-t border-line-subtle">
                ⚠ {handoffs.length} handoff{handoffs.length === 1 ? "" : "s"} still waiting.{" "}
                <Link href="/notifications" className="underline">Review →</Link>
              </p>
            )}
          </RailCard>
        }
      />

      {handoffs.length === 0 && cooApprovals.length === 0 && customerCount === 0 && (
        <DashboardSection>
          <EmptyState
            Icon={AlertTriangle}
            title="Nothing on your queue yet"
            body="When a salesperson initiates a handoff or requests a 20%+ discount, it shows up here for you. Until then, browse what's in motion via Pipeline or Accounts."
            cta={{ label: "Open pipeline", href: "/pipeline" }}
            secondaryCta={{ label: "Open accounts", href: "/accounts" }}
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
  children,
}: {
  icon: typeof Briefcase;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-surface border border-line-subtle p-4">
      <header className="flex items-center gap-2.5 mb-3">
        <span
          aria-hidden
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-soft text-gtn-purple"
        >
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

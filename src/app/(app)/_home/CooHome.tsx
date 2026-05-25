import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowRightLeft, Briefcase, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, ScoreBadge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/help/EmptyState";
import { DashboardPage, DashboardSection } from "@/components/templates";
import { DetailSplit } from "@/components/templates/DetailPage";
import { loadNotifications } from "@/lib/notifications";
import { CustomerStatus, PipelineStage, type Role } from "@prisma/client";

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

  const [notifications, customerCount, lateStageLeads, recentCustomers] = await Promise.all([
    loadNotifications({ id: user.id, role: user.role }),
    prisma.customer.count({
      where: { status: { in: [CustomerStatus.ONBOARDING, CustomerStatus.ACTIVE] } },
    }),
    prisma.lead.findMany({
      where: {
        pipelineStage: { in: [PipelineStage.PROPOSAL, PipelineStage.NEGOTIATION] },
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
  ]);

  const handoffs = notifications.handoffsAwaiting;
  const cooApprovals = notifications.pricingApprovalsPending.filter((p) => p.tier === "COO");

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
          />
          <StatCard
            label="20%+ approvals"
            value={cooApprovals.length}
            icon={DollarSign}
            tone={cooApprovals.length > 0 ? "warn" : "neutral"}
            href="/notifications"
          />
          <StatCard
            label="Active customers"
            value={customerCount}
            icon={Briefcase}
            tone="brand"
            href="/accounts"
          />
          <StatCard
            label="Late-stage leads"
            value={lateStageLeads.length}
            icon={TrendingUp}
            tone="neutral"
            href="/pipeline"
          />
        </>
      }
    >
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
            subtitle="Proposal and negotiation — keep an eye on these."
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

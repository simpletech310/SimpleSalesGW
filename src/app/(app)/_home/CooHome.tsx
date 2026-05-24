import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowRightLeft, Briefcase, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/help/EmptyState";
import { HeroBand } from "@/components/brand";
import { loadNotifications } from "@/lib/notifications";
import { CustomerStatus, PipelineStage, type Role } from "@prisma/client";

/**
 * CooHome — Marcelo-as-COO's landing.
 *
 * The COO accepts handoffs, approves the biggest discounts, and watches
 * the post-sale book of business. So their home is:
 *   - handoffs awaiting acceptance (the top of-mind queue)
 *   - 20%+ pricing approvals (their tier)
 *   - active customers count + recent additions
 *   - pipeline-late stages (Proposal/Negotiation) for forecast visibility
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
  // Only the 20%+ tier needs COO approval; the rest is Sales Manager territory.
  const cooApprovals = notifications.pricingApprovalsPending.filter((p) => p.tier === "COO");

  return (
    <div className="space-y-6">
      <HeroBand
        eyebrow="OPS DASHBOARD"
        title={`Welcome back, ${firstName}`}
        subtitle="Approve handoffs, sign off on the biggest discounts, and keep an eye on the customer book."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/notifications">All notifications</Link>
            </Button>
            <Button asChild>
              <Link href="/accounts">Customer book</Link>
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-2xl">
          <Stat label="Handoffs awaiting" value={handoffs.length} urgent={handoffs.length > 0} />
          <Stat label="20%+ approvals" value={cooApprovals.length} urgent={cooApprovals.length > 0} />
          <Stat label="Active customers" value={customerCount} />
          <Stat label="Late-stage leads" value={lateStageLeads.length} />
        </div>
      </HeroBand>

      {/* Top priority: handoffs */}
      <div className="space-y-3">
        <SectionHeading
          icon={ArrowRightLeft}
          title="Handoffs awaiting your acceptance"
          subtitle="A salesperson handed a closed deal across — review and accept to spawn an Account."
        />
        {handoffs.length === 0 ? (
          <Card className="text-sm text-gtn-grey-2">No handoffs waiting. Nice and clean.</Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-gtn-lavender text-left text-xs uppercase tracking-wide text-gtn-grey-2">
                <tr>
                  <th className="px-4 py-2">Lead</th>
                  <th className="px-4 py-2 hidden md:table-cell">Initiator</th>
                  <th className="px-4 py-2">Waiting</th>
                  <th className="px-4 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {handoffs.map((h) => (
                  <tr key={h.id} className="border-t border-gtn-lavender-2">
                    <td className="px-4 py-2 font-medium text-gtn-navy">
                      <Link href={`/leads/${h.leadId}`} className="hover:underline">{h.leadName}</Link>
                    </td>
                    <td className="px-4 py-2 text-gtn-grey-2 hidden md:table-cell">{h.initiatorName}</td>
                    <td className="px-4 py-2 text-gtn-grey-2">
                      {formatDistanceToNow(new Date(h.initiatedAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href="/notifications"
                        className="text-xs font-medium text-gtn-purple hover:underline"
                      >
                        Review & accept →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Card>
        )}
      </div>

      {/* Two-column: pricing approvals + late-stage + recent customers */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <SectionHeading icon={DollarSign} title="Pricing approvals (20%+)" />
          {cooApprovals.length === 0 ? (
            <p className="text-xs text-gtn-grey-2 mt-2">Nothing in your queue.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {cooApprovals.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/leads/${p.leadId}`} className="text-gtn-navy hover:text-gtn-purple truncate block">
                      {p.leadName}
                    </Link>
                    <span className="text-xs text-gtn-grey-3">
                      {p.discountPct}% off · ${p.proposedPrice.toLocaleString()}/mo
                      {p.belowFloor && <span className="text-gtn-red"> · below floor</span>}
                    </span>
                  </div>
                  <Link href="/notifications" className="text-xs text-gtn-purple hover:underline flex-shrink-0">
                    Review →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeading icon={TrendingUp} title="Late-stage deals" href="/pipeline" />
          {lateStageLeads.length === 0 ? (
            <p className="text-xs text-gtn-grey-2 mt-2">No deals in Proposal/Negotiation.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {lateStageLeads.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/leads/${l.id}`} className="text-gtn-navy hover:text-gtn-purple truncate block">
                      {l.businessName}
                    </Link>
                    <span className="text-xs text-gtn-grey-3">
                      {l.pipelineStage.replace(/_/g, " ").toLowerCase()} · {l.owner?.name ?? "—"}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-gtn-navy flex-shrink-0">{l.dealQualityScore}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeading icon={Briefcase} title="Newest customers" href="/accounts" />
          {recentCustomers.length === 0 ? (
            <p className="text-xs text-gtn-grey-2 mt-2">No customers yet.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {recentCustomers.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-2">
                  <Link href={`/accounts/${c.id}`} className="text-gtn-navy hover:text-gtn-purple truncate">
                    {c.lead.businessName}
                  </Link>
                  <span className="text-xs text-gtn-grey-3 flex-shrink-0">
                    {format(new Date(c.createdAt), "MMM d")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {handoffs.length === 0 && cooApprovals.length === 0 && customerCount === 0 && (
        <EmptyState
          Icon={AlertTriangle}
          title="Nothing on your queue yet"
          body="When a salesperson initiates a handoff or requests a 20%+ discount, it shows up here for you. Until then, browse what's in motion via Pipeline or Accounts."
          cta={{ label: "Open pipeline", href: "/pipeline" }}
          secondaryCta={{ label: "Open accounts", href: "/accounts" }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, urgent }: { label: string; value: number; urgent?: boolean }) {
  return (
    <div>
      <p className="gtn-eyebrow">{label}</p>
      <p className={`text-2xl font-bold ${urgent ? "text-gtn-amber" : "text-white"}`}>{value}</p>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  href,
}: {
  icon: typeof Briefcase;
  title: string;
  subtitle?: string;
  href?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold text-gtn-navy flex items-center gap-2">
          <Icon className="h-4 w-4 text-gtn-purple" />
          {title}
        </h2>
        {subtitle && <p className="text-xs text-gtn-grey-2 mt-0.5">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="text-xs text-gtn-purple hover:underline flex-shrink-0">
          View all →
        </Link>
      )}
    </div>
  );
}

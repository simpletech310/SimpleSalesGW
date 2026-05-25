import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { AiFeatureKind } from "@prisma/client";
import { Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { DashboardPage, DashboardSection } from "@/components/templates";
import { loadBudget, spendForOrg } from "@/lib/ai/budget";

const FEATURE_LABEL: Record<AiFeatureKind, string> = {
  RESEARCH_SUMMARY:    "Research summary",
  OBJECTION_REBUTTAL:  "Objection coach",
  DISCOVERY_PREP:      "Discovery prep",
  OUTREACH_PERSONALIZE:"Outreach personalize",
  PRESALE_NARRATIVE:   "Pre-sale narrative",
  HANDOFF_QC:          "Handoff QC",
  SALES_COACH:         "Sales coach",
  VCIO_RECOMMENDATION: "vCIO recommendations",
};

export default async function AiUsagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "audit:view")) redirect("/");
  const sp = await searchParams;
  const featureFilter = sp.feature as AiFeatureKind | undefined;
  const leadFilter = sp.lead?.trim() || undefined;

  const [config, org, perFeature, recent] = await Promise.all([
    loadBudget(),
    spendForOrg(),
    prisma.aiUsageLog.groupBy({
      by: ["feature"],
      where: { createdAt: { gte: startOfMonth() } },
      _count: { _all: true },
      _sum: { estimatedCostUsd: true, inputTokens: true, outputTokens: true },
    }),
    prisma.aiUsageLog.findMany({
      where: {
        ...(featureFilter ? { feature: featureFilter } : {}),
        ...(leadFilter ? { leadId: leadFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        lead: { select: { id: true, businessName: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const orgPct = Math.min(100, (org.costUsdThisMonth / config.orgMonthlyCostUsd) * 100);
  const remaining = Math.max(0, config.orgMonthlyCostUsd - org.costUsdThisMonth);

  type FeatureRow = (typeof perFeature)[number];
  const featureColumns: Column<FeatureRow>[] = [
    {
      key: "feature",
      header: "Feature",
      cell: (row) => (
        <Link href={`/admin/ai-usage?feature=${row.feature}`} className="text-gtn-purple hover:underline font-medium">
          {FEATURE_LABEL[row.feature]}
        </Link>
      ),
    },
    { key: "calls",  header: "Calls",         numeric: true, cell: (r) => r._count._all },
    { key: "in",     header: "Input tokens",  numeric: true, cell: (r) => (r._sum.inputTokens ?? 0).toLocaleString() },
    { key: "out",    header: "Output tokens", numeric: true, cell: (r) => (r._sum.outputTokens ?? 0).toLocaleString() },
    {
      key: "cost",
      header: "Spend",
      numeric: true,
      cell: (r) => `$${Number(r._sum.estimatedCostUsd ?? 0).toFixed(4)}`,
    },
  ];

  type LogRow = (typeof recent)[number];
  const logColumns: Column<LogRow>[] = [
    {
      key: "when",
      header: "When",
      width: "120px",
      cell: (r) => <span className="text-xs text-ink-muted tabular">{format(r.createdAt, "MMM d HH:mm")}</span>,
    },
    {
      key: "feature",
      header: "Feature",
      cell: (r) => (
        <Link href={`/admin/ai-usage?feature=${r.feature}`} className="text-gtn-purple hover:underline text-xs">
          {FEATURE_LABEL[r.feature]}
        </Link>
      ),
    },
    {
      key: "lead",
      header: "Lead",
      cell: (r) =>
        r.lead ? (
          <Link href={`/leads/${r.lead.id}`} className="text-ink-strong text-xs hover:text-gtn-purple">
            {r.lead.businessName}
          </Link>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "user",
      header: "User",
      hideOnMobile: true,
      cell: (r) =>
        r.user ? <span className="text-xs text-ink-muted">{r.user.name ?? r.user.email}</span> : <span className="text-ink-faint">—</span>,
    },
    {
      key: "tokens",
      header: "In / Out tokens",
      numeric: true,
      cell: (r) => `${r.inputTokens} / ${r.outputTokens}`,
    },
    {
      key: "cost",
      header: "Cost",
      numeric: true,
      cell: (r) => `$${Number(r.estimatedCostUsd).toFixed(4)}`,
    },
  ];

  return (
    <DashboardPage
      eyebrow="Administration"
      title="AI usage"
      subtitle={
        <>
          Month-to-date Claude spend. Caps: per-lead {config.perLeadMonthlyCallCap} calls / ${config.perLeadMonthlyCostUsd.toFixed(2)}, org $
          {config.orgMonthlyCostUsd.toFixed(2)}. Tune in{" "}
          <Link href="/admin/config" className="text-gtn-purple hover:underline font-medium">System config</Link>.
        </>
      }
      crumbs={[{ href: "/admin", label: "Admin" }, { label: "AI usage" }]}
      kpis={
        <>
          <StatCard
            label="Spend month-to-date"
            value={`$${org.costUsdThisMonth.toFixed(2)}`}
            sub={`of $${config.orgMonthlyCostUsd.toFixed(2)} budget`}
            icon={Sparkles}
            tone={orgPct >= 90 ? "danger" : orgPct >= 70 ? "warn" : "success"}
          />
          <StatCard label="Calls this month" value={org.callsThisMonth} icon={Sparkles} tone="brand" />
          <StatCard label="Budget used" value={`${orgPct.toFixed(1)}%`} icon={Sparkles} tone={orgPct >= 90 ? "danger" : orgPct >= 70 ? "warn" : "success"} />
          <StatCard label="Remaining" value={`$${remaining.toFixed(2)}`} icon={Sparkles} tone="neutral" />
        </>
      }
    >
      <DashboardSection title="By feature this month" flush>
        {perFeature.length === 0 ? (
          <p className="px-4 md:px-5 py-6 text-sm text-ink-muted">No Claude calls this month yet.</p>
        ) : (
          <DataTable
            columns={featureColumns}
            rows={perFeature
              .slice()
              .sort((a, b) => Number(b._sum.estimatedCostUsd ?? 0) - Number(a._sum.estimatedCostUsd ?? 0))}
            getRowKey={(r) => r.feature}
            density="default"
            className="border-0 rounded-none"
          />
        )}
      </DashboardSection>

      <DashboardSection
        title={`Recent calls${featureFilter ? ` · ${FEATURE_LABEL[featureFilter]}` : ""}${leadFilter ? " · lead filter" : ""}`}
        subtitle="Last 100 Claude calls"
        actions={
          (featureFilter || leadFilter) && (
            <Link href="/admin/ai-usage" className="text-xs text-gtn-purple hover:underline font-medium">
              Clear filters
            </Link>
          )
        }
        flush
      >
        <DataTable
          columns={logColumns}
          rows={recent}
          getRowKey={(r) => r.id}
          density="compact"
          empty="No matching calls."
          className="border-0 rounded-none"
        />
      </DashboardSection>
    </DashboardPage>
  );
}

function startOfMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

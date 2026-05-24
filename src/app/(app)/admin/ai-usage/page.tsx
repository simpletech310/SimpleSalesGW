import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { AiFeatureKind } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { Card } from "@/components/ui/Card";
import { loadBudget, spendForOrg } from "@/lib/ai/budget";

const FEATURE_LABEL: Record<AiFeatureKind, string> = {
  RESEARCH_SUMMARY: "Research summary",
  OBJECTION_REBUTTAL: "Objection coach",
  DISCOVERY_PREP: "Discovery prep",
  OUTREACH_PERSONALIZE: "Outreach personalize",
  PRESALE_NARRATIVE: "Pre-sale narrative",
  HANDOFF_QC: "Handoff QC",
  SALES_COACH: "Sales coach",
};

/**
 * v2.20f — /admin/ai-usage
 *
 * Org-wide month-to-date Claude spend with per-feature breakdown and the
 * 100 most recent AiUsageLog rows. Filterable by feature + lead via query
 * string (?feature=RESEARCH_SUMMARY&lead=<id>).
 */
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gtn-navy">AI usage</h1>
      <p className="text-sm text-gtn-grey-2 -mt-2">
        Month-to-date Claude spend. Caps: per-lead {config.perLeadMonthlyCallCap} calls /
        ${config.perLeadMonthlyCostUsd.toFixed(2)}, org ${config.orgMonthlyCostUsd.toFixed(2)}.
        Tune in <Link href="/admin/config" className="text-gtn-purple underline">System config</Link>.
      </p>

      {/* Org-wide tile */}
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wide text-gtn-grey-2">Org month-to-date</p>
            <p className="text-2xl font-bold text-gtn-navy mt-1">
              ${org.costUsdThisMonth.toFixed(2)}
              <span className="text-sm text-gtn-grey-2 font-normal"> of ${config.orgMonthlyCostUsd.toFixed(2)}</span>
            </p>
            <p className="text-xs text-gtn-grey-2 mt-1">
              {org.callsThisMonth} call{org.callsThisMonth === 1 ? "" : "s"} this month
            </p>
          </div>
          <div className="w-48">
            <div className="h-2 bg-gtn-lavender rounded-full overflow-hidden">
              <div
                className={`h-full ${orgPct >= 90 ? "bg-gtn-red" : orgPct >= 70 ? "bg-gtn-amber" : "bg-gtn-green"}`}
                style={{ width: `${orgPct.toFixed(1)}%` }}
              />
            </div>
            <p className="text-[10px] text-gtn-grey-2 text-right mt-1">{orgPct.toFixed(1)}% used</p>
          </div>
        </div>
      </Card>

      {/* Per-feature breakdown */}
      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">By feature this month</h2>
        {perFeature.length === 0 ? (
          <p className="text-sm text-gtn-grey-2">No Claude calls this month yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-gtn-grey-2">
              <tr>
                <th className="py-2">Feature</th>
                <th className="py-2 text-right">Calls</th>
                <th className="py-2 text-right">Input tokens</th>
                <th className="py-2 text-right">Output tokens</th>
                <th className="py-2 text-right">Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gtn-lavender-2">
              {perFeature
                .slice()
                .sort((a, b) => Number(b._sum.estimatedCostUsd ?? 0) - Number(a._sum.estimatedCostUsd ?? 0))
                .map((row) => (
                  <tr key={row.feature}>
                    <td className="py-2">
                      <Link
                        href={`/admin/ai-usage?feature=${row.feature}`}
                        className="text-gtn-purple underline"
                      >
                        {FEATURE_LABEL[row.feature]}
                      </Link>
                    </td>
                    <td className="py-2 text-right font-mono">{row._count._all}</td>
                    <td className="py-2 text-right font-mono">{(row._sum.inputTokens ?? 0).toLocaleString()}</td>
                    <td className="py-2 text-right font-mono">{(row._sum.outputTokens ?? 0).toLocaleString()}</td>
                    <td className="py-2 text-right font-mono">${Number(row._sum.estimatedCostUsd ?? 0).toFixed(4)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Recent calls log */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gtn-lavender-2 flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-gtn-navy">
            Recent calls {featureFilter ? `· ${FEATURE_LABEL[featureFilter]}` : ""}{leadFilter ? ` · lead filter` : ""}
          </h2>
          {(featureFilter || leadFilter) && (
            <Link href="/admin/ai-usage" className="text-xs text-gtn-purple underline">
              clear filters
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gtn-grey-2">No matching calls.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gtn-lavender text-left text-xs uppercase tracking-wide text-gtn-grey-2">
              <tr>
                <th className="px-3 py-3">When</th>
                <th className="px-3 py-3">Feature</th>
                <th className="px-3 py-3">Lead</th>
                <th className="px-3 py-3">User</th>
                <th className="px-3 py-3 text-right">In/Out tokens</th>
                <th className="px-3 py-3 text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gtn-lavender-2">
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 text-xs text-gtn-grey-2">
                    {format(r.createdAt, "MMM d HH:mm")}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <Link
                      href={`/admin/ai-usage?feature=${r.feature}`}
                      className="text-gtn-purple underline"
                    >
                      {FEATURE_LABEL[r.feature]}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.lead ? (
                      <Link href={`/leads/${r.lead.id}`} className="text-gtn-purple underline">
                        {r.lead.businessName}
                      </Link>
                    ) : <span className="text-gtn-grey-3">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.user?.name ?? r.user?.email ?? <span className="text-gtn-grey-3">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-right font-mono">
                    {r.inputTokens} / {r.outputTokens}
                  </td>
                  <td className="px-3 py-2 text-xs text-right font-mono">
                    ${Number(r.estimatedCostUsd).toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function startOfMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

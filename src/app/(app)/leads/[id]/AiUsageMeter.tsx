import Link from "next/link";
import { Sparkles } from "lucide-react";
import { loadBudget, spendForLead } from "@/lib/ai/budget";

/**
 * v2.20f — Inline per-lead AI usage meter for the lead detail page.
 *
 * Server component — pulls the lead's month-to-date AiUsageLog rows + the
 * effective budget caps and renders a compact bar. Visible to anyone with
 * access to the lead; admins get a link through to /admin/ai-usage filtered
 * to this lead.
 */
export async function AiUsageMeter({ leadId }: { leadId: string }) {
  const [budget, spend] = await Promise.all([loadBudget(), spendForLead(leadId)]);
  const callPct = Math.min(100, (spend.callsThisMonth / budget.perLeadMonthlyCallCap) * 100);
  const costPct = Math.min(100, (spend.costUsdThisMonth / budget.perLeadMonthlyCostUsd) * 100);
  const worst = Math.max(callPct, costPct);
  const bar = worst >= 90 ? "bg-gtn-red" : worst >= 70 ? "bg-gtn-amber" : "bg-gtn-purple";

  if (spend.callsThisMonth === 0) {
    return (
      <div className="text-[11px] text-gtn-grey-3 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" />
        AI: 0 / {budget.perLeadMonthlyCallCap} calls this month
      </div>
    );
  }

  return (
    <Link
      href={`/admin/ai-usage?lead=${leadId}`}
      className="group inline-flex items-center gap-2 rounded-md border border-gtn-lavender-2 bg-white px-2.5 py-1.5 hover:border-gtn-purple/40"
      title="Open AI usage log filtered to this lead"
    >
      <Sparkles className="h-3.5 w-3.5 text-gtn-purple" />
      <span className="text-[11px] text-gtn-grey-2">
        AI this month:{" "}
        <strong className="text-gtn-navy">{spend.callsThisMonth}</strong>
        <span className="text-gtn-grey-3"> / {budget.perLeadMonthlyCallCap} calls</span>
        {" · "}
        <strong className="text-gtn-navy">${spend.costUsdThisMonth.toFixed(2)}</strong>
        <span className="text-gtn-grey-3"> / ${budget.perLeadMonthlyCostUsd.toFixed(2)}</span>
      </span>
      <span className="w-12 h-1.5 bg-gtn-lavender rounded-full overflow-hidden">
        <span className={`block h-full ${bar}`} style={{ width: `${worst.toFixed(0)}%` }} />
      </span>
    </Link>
  );
}

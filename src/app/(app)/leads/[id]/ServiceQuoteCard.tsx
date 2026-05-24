"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { DealKind, Role, ServiceBundle } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import {
  DEAL_KIND_META,
  LINE_ITEM_STICKERS,
  totalsFor,
  type LineItem,
  type LineItemKind,
} from "@/lib/pricing/deal-kinds";
import { fmtUsd } from "@/lib/pricing/catalog";

/**
 * v2.15 — line-item quote builder for non-bundle deal kinds.
 *
 * Replaces the seat-based PricingCard for VOICE_ONLY / VOICE_PLUS_VIDEO /
 * STRUCTURED_CABLING_JOB / ACCESS_CONTROL_PROJECT / VIDEO_SURVEILLANCE_PROJECT /
 * CUSTOM_MIX deals. Salesperson:
 *   1. Adds rows for each line item kind relevant to the deal
 *   2. Sets quantities (per-unit prices come from LINE_ITEM_STICKERS)
 *   3. Saves the quote → persists to Lead.dealLineItems
 *   4. Submits for approval → creates a PricingApproval with the computed totals
 *
 * Approval-tier routing still flows through the standard
 * /api/leads/[id]/pricing-approvals endpoint — so Sales Manager + COO see
 * these on the same /notifications queue as bundle deals.
 */

type ApprovalRow = {
  id: string;
  stickerPrice: string;
  proposedPrice: string;
  stickerOneTime: string | null;
  proposedOneTime: string | null;
  discountPct: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  decisionNote: string | null;
  createdAt: string;
  requester: { name: string };
  approver: { name: string } | null;
};

export function ServiceQuoteCard({
  leadId,
  role,
  dealKind,
  initialLineItems,
  canEdit,
}: {
  leadId: string;
  role: Role;
  dealKind: DealKind;
  initialLineItems: LineItem[] | null;
  canEdit: boolean;
}) {
  void role; // role is reserved for future tier-aware UI hints
  const router = useRouter();
  const meta = DEAL_KIND_META[dealKind];
  const [lines, setLines] = useState<LineItem[]>(initialLineItems ?? []);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approvals, setApprovals] = useState<ApprovalRow[] | null>(null);

  // Load past approvals so the salesperson sees decision history.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/leads/${leadId}/pricing-approvals`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (!cancelled) setApprovals(data.approvals);
    })();
    return () => { cancelled = true; };
  }, [leadId]);

  const totals = useMemo(() => totalsFor(lines), [lines]);

  function addLine(kind: LineItemKind) {
    const sticker = LINE_ITEM_STICKERS[kind];
    setLines((prev) => [
      ...prev,
      {
        kind,
        label: sticker.label,
        qty: 1,
        perUnitMrr: sticker.perUnitMrr,
        perUnitOneTime: sticker.perUnitOneTime,
      },
    ]);
  }

  function updateQty(idx: number, qty: number) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, qty: Math.max(1, Math.floor(qty || 1)) } : l)));
  }

  function updateLabel(idx: number, label: string) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, label } : l)));
  }

  function updatePrice(idx: number, field: "perUnitMrr" | "perUnitOneTime", v: number) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: Math.max(0, v || 0) } : l)));
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  async function saveQuote() {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealLineItems: { lines } }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Save failed");
        return;
      }
      toast.success("Quote saved");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function submitForApproval() {
    if (lines.length === 0) {
      toast.error("Add at least one line item before submitting.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Tell the approver what this quote is for.");
      return;
    }
    setSubmitting(true);
    try {
      // Save the line items first so the lead detail page reflects the same
      // quote the approver is reviewing.
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealLineItems: { lines } }),
      });

      // Build a structured reason that includes the line summary so the COO
      // can see what was sold without opening the lead. We use bundleId=CUSTOM
      // because the standard PricingApproval shape expects one.
      const summary = lines.map((l) => `${l.qty}× ${l.label}`).join("; ");
      const fullReason = `[${meta.label}] ${reason.trim()}\n\nLine items: ${summary}`;

      const res = await fetch(`/api/leads/${leadId}/pricing-approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundleId: ServiceBundle.CUSTOM,
          stickerMrr: totals.monthlyMrr,
          proposedMrr: totals.monthlyMrr, // no discount on direct quote; approver can negotiate
          stickerOneTime: totals.oneTime,
          proposedOneTime: totals.oneTime,
          reason: fullReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Submit failed");
        return;
      }
      toast.success(`Quote submitted for ${data.approval?.tier ?? "approval"}.`);
      setReason("");
      setApprovals((prev) => (prev ? [data.approval, ...prev] : [data.approval]));
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-gtn-navy">Quote — {meta.label}</h3>
          <p className="text-xs text-gtn-grey-2">{meta.tagline}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gtn-grey-2">Monthly recurring</p>
          <p className="text-xl font-mono font-bold text-gtn-navy">{fmtUsd(totals.monthlyMrr)}</p>
          <p className="text-xs text-gtn-grey-2 mt-1">
            One-time: <span className="font-mono text-gtn-navy">{fmtUsd(totals.oneTime)}</span>
          </p>
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="text-xs text-gtn-grey-2 mb-3">No line items yet. Use the buttons below to add some.</p>
      ) : (
        <div className="border border-gtn-lavender-2 rounded-md overflow-hidden mb-3">
          {/* v2.18 — horizontal scroll so the qty + price columns stay legible on phones */}
          <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[560px]">
            <thead className="bg-gtn-lavender text-left uppercase tracking-wide text-gtn-grey-2">
              <tr>
                <th className="px-2 py-2">Line</th>
                <th className="px-2 py-2 w-16 text-right">Qty</th>
                <th className="px-2 py-2 w-24 text-right">$/mo each</th>
                <th className="px-2 py-2 w-24 text-right">One-time each</th>
                <th className="px-2 py-2 w-24 text-right">Subtotal /mo</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={idx} className="border-t border-gtn-lavender-2">
                  <td className="px-2 py-1">
                    {canEdit ? (
                      <Input
                        value={l.label}
                        onChange={(e) => updateLabel(idx, e.target.value)}
                        className="h-7 text-xs"
                      />
                    ) : l.label}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {canEdit ? (
                      <Input
                        type="number"
                        min={1}
                        value={l.qty}
                        onChange={(e) => updateQty(idx, Number(e.target.value))}
                        className="h-7 text-xs text-right"
                      />
                    ) : l.qty}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {canEdit ? (
                      <Input
                        type="number"
                        min={0}
                        value={l.perUnitMrr}
                        onChange={(e) => updatePrice(idx, "perUnitMrr", Number(e.target.value))}
                        className="h-7 text-xs text-right"
                      />
                    ) : fmtUsd(l.perUnitMrr)}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {canEdit ? (
                      <Input
                        type="number"
                        min={0}
                        value={l.perUnitOneTime}
                        onChange={(e) => updatePrice(idx, "perUnitOneTime", Number(e.target.value))}
                        className="h-7 text-xs text-right"
                      />
                    ) : fmtUsd(l.perUnitOneTime)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-gtn-navy">
                    {fmtUsd(l.qty * l.perUnitMrr)}
                  </td>
                  <td className="px-2 py-1">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="text-gtn-grey-2 hover:text-gtn-red"
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {canEdit && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {meta.lineItemKinds.map((kind) => (
              <Button
                key={kind}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => addLine(kind)}
                title={LINE_ITEM_STICKERS[kind].helpText}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {LINE_ITEM_STICKERS[kind].label}
              </Button>
            ))}
          </div>

          <div className="space-y-2 mb-3">
            <Label htmlFor={`quote-reason-${leadId}`}>Notes for the approver</Label>
            <Input
              id={`quote-reason-${leadId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. 3-year term, customer ready to sign by EOM"
              maxLength={400}
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button type="button" variant="secondary" onClick={saveQuote} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Save quote (draft)
            </Button>
            <Button type="button" onClick={submitForApproval} disabled={submitting || lines.length === 0}>
              {submitting && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Submit for approval
            </Button>
          </div>
        </>
      )}

      {/* Past approvals */}
      {approvals && approvals.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gtn-lavender-2">
          <h4 className="text-xs font-semibold text-gtn-navy uppercase tracking-wide mb-2">
            Quote history
          </h4>
          <ul className="space-y-2">
            {approvals.map((a) => (
              <li key={a.id} className="text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusPill status={a.status} />
                  <span className="font-mono text-gtn-navy">{fmtUsd(Number(a.proposedPrice))}/mo</span>
                  {a.proposedOneTime && (
                    <span className="text-gtn-grey-2">+ {fmtUsd(Number(a.proposedOneTime))} one-time</span>
                  )}
                  <span className="text-gtn-grey-3">· requested by {a.requester.name}</span>
                  {a.approver && (
                    <span className="text-gtn-grey-3">· decided by {a.approver.name}</span>
                  )}
                </div>
                {a.decisionNote && (
                  <p className="text-gtn-grey-2 mt-1 italic">&ldquo;{a.decisionNote}&rdquo;</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function StatusPill({ status }: { status: ApprovalRow["status"] }) {
  const cls =
    status === "APPROVED" ? "bg-gtn-green-bg text-gtn-green"
      : status === "REJECTED" ? "bg-[#FBE9E7] text-gtn-red"
      : "bg-[#FEF3E2] text-gtn-amber";
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${cls}`}>
      {status}
    </span>
  );
}

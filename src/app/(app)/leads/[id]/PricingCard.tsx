"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { discountPercent, approvalTier } from "@/lib/pricing";
import type { Role } from "@prisma/client";

type ApprovalRow = {
  id: string;
  stickerPrice: string;
  proposedPrice: string;
  discountPct: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  requester: { name: string };
  approver: { name: string } | null;
};

export function PricingCard({ leadId, role }: { leadId: string; role: Role }) {
  const router = useRouter();
  const [items, setItems] = useState<ApprovalRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [sticker, setSticker] = useState("");
  const [proposed, setProposed] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}/pricing-approvals`);
    const data = await res.json();
    if (res.ok) setItems(data.approvals);
  }, [leadId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const stickerN = Number(sticker);
  const proposedN = Number(proposed);
  const pct = stickerN > 0 ? discountPercent(stickerN, proposedN) : 0;
  const tier = approvalTier(pct);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/pricing-approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stickerPrice: stickerN, proposedPrice: proposedN, reason }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data?.error ?? "Failed");
      else {
        toast.success(`Request sent to ${data.tier === "MANAGER" ? "Sales Manager" : "COO"}`);
        setOpen(false); setSticker(""); setProposed(""); setReason("");
        await refresh();
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function decide(id: string, action: "approve" | "reject") {
    let note: string | undefined;
    if (action === "reject") {
      const v = prompt("Reason for rejection?");
      if (!v) return;
      note = v;
    } else {
      const v = prompt("Optional approval note (or leave blank):") ?? undefined;
      note = v && v.trim() ? v.trim() : undefined;
    }
    const res = await fetch(`/api/pricing-approvals/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data?.error ?? "Failed");
      return;
    }
    toast.success(action === "approve" ? "Approved" : "Rejected");
    await refresh();
    router.refresh();
  }

  const canApproveManager = role === "SALES_MANAGER" || role === "SUPERADMIN";
  const canApproveCoo = role === "COO" || role === "SUPERADMIN";

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gtn-navy">Pricing</h3>
        <Button variant="secondary" onClick={() => setOpen((o) => !o)}>
          {open ? "Cancel" : "Request approval"}
        </Button>
      </div>

      {open && (
        <form onSubmit={submit} className="space-y-3 border-b border-gtn-lavender-2 pb-4 mb-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Sticker price ($)</Label>
              <Input type="number" step="0.01" min="0" value={sticker} onChange={(e) => setSticker(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Proposed price ($)</Label>
              <Input type="number" step="0.01" min="0" value={proposed} onChange={(e) => setProposed(e.target.value)} required />
            </div>
          </div>
          {stickerN > 0 && (
            <p className="text-xs text-gtn-grey-2">
              Discount: <span className="font-mono">{pct.toFixed(1)}%</span>
              {tier !== "NONE" && (
                <> · routes to <strong>{tier === "MANAGER" ? "Sales Manager" : "COO"}</strong></>
              )}
            </p>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Reason *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} placeholder="Why is this discount warranted?" />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !reason.trim() || tier === "NONE"}>
              {saving ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </form>
      )}

      {items === null ? (
        <p className="text-sm text-gtn-grey-2">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gtn-grey-2">No pricing requests yet.</p>
      ) : (
        <ul className="divide-y divide-gtn-lavender-2">
          {items.map((a) => {
            const t = approvalTier(Number(a.discountPct));
            const canDecide = a.status === "PENDING" && ((t === "MANAGER" && canApproveManager) || (t === "COO" && canApproveCoo));
            return (
              <li key={a.id} className="py-3 text-sm space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-gtn-navy">
                      ${Number(a.proposedPrice).toFixed(2)} <span className="text-gtn-grey-3">vs sticker ${Number(a.stickerPrice).toFixed(2)}</span> · <span className="font-mono">{Number(a.discountPct).toFixed(1)}%</span>
                    </p>
                    <p className="text-xs text-gtn-grey-3">
                      {a.requester.name} · {format(new Date(a.createdAt), "PPp")}
                    </p>
                  </div>
                  <StatusPill status={a.status} />
                </div>
                <p className="text-xs text-gtn-grey-2">{a.reason}</p>
                {a.decisionNote && (
                  <p className="text-xs text-gtn-grey-2"><strong>Note:</strong> {a.decisionNote}</p>
                )}
                {canDecide && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => decide(a.id, "approve")}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => decide(a.id, "reject")}>Reject</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function StatusPill({ status }: { status: ApprovalRow["status"] }) {
  const cls = status === "APPROVED"
    ? "bg-gtn-green-bg text-gtn-green"
    : status === "REJECTED"
    ? "bg-[#FBE9E7] text-gtn-red"
    : "bg-[#FEF3E2] text-gtn-amber";
  return <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${cls}`}>{status}</span>;
}

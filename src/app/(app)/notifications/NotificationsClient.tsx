"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/brand";
import { can } from "@/lib/rbac";

type PricingRow = {
  id: string;
  leadId: string;
  leadName: string;
  discountPct: number;
  proposedPrice: number;
  stickerPrice: number;
  requesterName: string;
  belowFloor: boolean;
  tier: "MANAGER" | "COO";
  createdAt: string;
};

type HandoffRow = {
  id: string;
  leadId: string;
  leadName: string;
  initiatorName: string;
  initiatedAt: string;
};

/**
 * Inline actions for the /notifications page (v2.6).
 *
 * Replaces the prior "link to lead" rows for the two highest-value queues —
 * pricing approvals and handoff acceptance — with approve/reject buttons
 * that hit the existing REST endpoints. Optimistic remove + toast.
 */
export function PricingApprovalRows({ rows, role }: { rows: PricingRow[]; role: Role }) {
  const router = useRouter();
  const [items, setItems] = useState<PricingRow[]>(rows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function decide(p: PricingRow, action: "approve" | "reject") {
    const allowed =
      action === "approve" || action === "reject"
        ? (p.tier === "MANAGER" && can(role, "pricing:approve:5to20")) ||
          (p.tier === "COO" && can(role, "pricing:approve:20plus"))
        : false;
    if (!allowed) {
      toast.error("You don't have permission to act on this row.");
      return;
    }
    let note: string | undefined;
    if (action === "reject") {
      const v = window.prompt("Why is this being rejected? (required)");
      if (!v) return;
      note = v;
    } else {
      const v = window.prompt("Optional approval note (or leave blank):") ?? "";
      note = v.trim() ? v.trim() : undefined;
    }
    setBusyId(p.id);
    try {
      const res = await fetch(`/api/pricing-approvals/${p.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? "Failed");
        return;
      }
      setItems((cur) => cur.filter((x) => x.id !== p.id));
      toast.success(action === "approve" ? "Approved" : "Rejected");
      startTransition(() => router.refresh());
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return <p className="px-4 py-6 text-sm text-gtn-grey-2 text-center">No pricing requests in your queue.</p>;
  }

  return (
    <ul>
      {items.map((p) => {
        const actionable =
          (p.tier === "MANAGER" && can(role, "pricing:approve:5to20")) ||
          (p.tier === "COO" && can(role, "pricing:approve:20plus"));
        const tierLabel = p.tier === "MANAGER" ? "Sales Manager" : "COO";
        return (
          <li key={p.id} className="px-4 py-3 border-t border-gtn-lavender-2 first:border-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/leads/${p.leadId}`} className="text-sm font-medium text-gtn-navy hover:underline">
                    {p.leadName}
                  </Link>
                  <Pill tone={p.belowFloor ? "red" : "purple"} dot>
                    {p.discountPct.toFixed(1)}% off
                  </Pill>
                  {p.belowFloor && <Pill tone="red">below-floor</Pill>}
                  <span className="text-[10px] uppercase font-semibold text-gtn-grey-2">→ {tierLabel}</span>
                </div>
                <p className="text-xs text-gtn-grey-2 mt-1">
                  ${p.proposedPrice.toFixed(0)} / mo vs sticker ${p.stickerPrice.toFixed(0)} · requested by {p.requesterName} · {format(new Date(p.createdAt), "PPp")}
                </p>
              </div>
              {actionable && (
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" disabled={busyId === p.id} onClick={() => decide(p, "approve")}>
                    Approve
                  </Button>
                  <Button size="sm" variant="secondary" disabled={busyId === p.id} onClick={() => decide(p, "reject")}>
                    Reject
                  </Button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function HandoffRows({ rows, role }: { rows: HandoffRow[]; role: Role }) {
  const router = useRouter();
  const [items, setItems] = useState<HandoffRow[]>(rows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const canAct = can(role, "handoff:accept");

  async function decide(h: HandoffRow, action: "accept" | "reject") {
    if (!canAct) {
      toast.error("You don't have permission to accept handoffs.");
      return;
    }
    let body: Record<string, string> = {};
    if (action === "reject") {
      const reason = window.prompt("Why is this handoff being rejected? (required)");
      if (!reason) return;
      body = { reason };
    } else {
      const note = window.prompt("Optional acceptance note (or leave blank):") ?? "";
      if (note.trim()) body = { note: note.trim() };
    }
    setBusyId(h.id);
    try {
      const res = await fetch(`/api/handoffs/${h.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? "Failed");
        return;
      }
      setItems((cur) => cur.filter((x) => x.id !== h.id));
      toast.success(action === "accept" ? "Accepted — customer auto-created" : "Rejected");
      startTransition(() => router.refresh());
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return <p className="px-4 py-6 text-sm text-gtn-grey-2 text-center">No handoffs waiting.</p>;
  }

  return (
    <ul>
      {items.map((h) => (
        <li key={h.id} className="px-4 py-3 border-t border-gtn-lavender-2 first:border-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <Link href={`/leads/${h.leadId}`} className="text-sm font-medium text-gtn-navy hover:underline">
                {h.leadName}
              </Link>
              <p className="text-xs text-gtn-grey-2 mt-1">
                Initiated by {h.initiatorName} · {format(new Date(h.initiatedAt), "PPp")}
              </p>
            </div>
            {canAct && (
              <div className="flex gap-2 flex-shrink-0">
                <Button size="sm" disabled={busyId === h.id} onClick={() => decide(h, "accept")}>
                  Accept
                </Button>
                <Button size="sm" variant="secondary" disabled={busyId === h.id} onClick={() => decide(h, "reject")}>
                  Reject
                </Button>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

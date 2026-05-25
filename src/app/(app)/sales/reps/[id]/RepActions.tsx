"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2, PowerOff, Power, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

type RepOption = { id: string; name: string; email: string };

/**
 * Right-rail action cluster on the rep detail page. Two flows:
 *   1. Toggle active/inactive (PATCH /api/sales-reps/[id])
 *   2. Bulk-reassign open leads to another rep (POST .../reassign-leads)
 *
 * Reassign opens an inline panel rather than a modal so the manager can
 * see the lead count and pick the destination without losing context.
 */
export function RepActions({
  repId,
  repName,
  active,
  openLeadCount,
  otherReps,
}: {
  repId: string;
  repName: string;
  active: boolean;
  openLeadCount: number;
  otherReps: RepOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [toUserId, setToUserId] = useState("");

  async function toggleActive() {
    if (!confirm(active ? `Deactivate ${repName}? They lose portal access until reactivated.` : `Reactivate ${repName}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sales-reps/${repId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Update failed");
        return;
      }
      toast.success(active ? "Rep deactivated" : "Rep reactivated");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function reassign() {
    if (!toUserId) {
      toast.error("Pick a destination rep first");
      return;
    }
    const dest = otherReps.find((r) => r.id === toUserId)!;
    if (!confirm(`Move ${openLeadCount} open lead${openLeadCount === 1 ? "" : "s"} from ${repName} to ${dest.name}? Closed deals stay with ${repName} for commission history.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sales-reps/${repId}/reassign-leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Reassign failed");
        return;
      }
      toast.success(`Moved ${data.moved} lead${data.moved === 1 ? "" : "s"} to ${data.to}`);
      setReassignOpen(false);
      setToUserId("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-2 flex-wrap">
      {!reassignOpen ? (
        <>
          {openLeadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setReassignOpen(true)}
              disabled={busy || otherReps.length === 0}
              title={otherReps.length === 0 ? "No other active reps to move leads to" : ""}
            >
              <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
              Reassign leads
            </Button>
          )}
          <Button
            variant={active ? "ghost" : "primary"}
            size="sm"
            onClick={toggleActive}
            disabled={busy}
            className={cn(active && "text-danger hover:text-danger hover:bg-danger-soft")}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> :
              active ? <PowerOff className="h-3.5 w-3.5 mr-1.5" /> : <Power className="h-3.5 w-3.5 mr-1.5" />}
            {active ? "Deactivate" : "Reactivate"}
          </Button>
        </>
      ) : (
        <div className="w-full rounded-lg border border-line bg-surface p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink-strong inline-flex items-center gap-2">
              Move leads to
              <Badge tone="brand" shape="pill" size="xs">{openLeadCount} open</Badge>
            </p>
            <button
              onClick={() => { setReassignOpen(false); setToUserId(""); }}
              className="text-ink-muted hover:text-ink-strong transition-colors p-0.5"
              aria-label="Cancel"
              disabled={busy}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <select
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink-strong hover:border-line-strong focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-colors"
            disabled={busy}
          >
            <option value="">— pick a destination rep —</option>
            {otherReps.map((r) => (
              <option key={r.id} value={r.id}>{r.name} · {r.email}</option>
            ))}
          </select>
          <p className="text-[11px] text-ink-faint leading-relaxed">
            Closed-won / closed-lost deals stay with {repName} for commission history.
            Nurture deals stay too — only active-pipeline leads move.
          </p>
          <div className="flex justify-end gap-2 pt-1 border-t border-line-subtle">
            <Button variant="ghost" size="sm" onClick={() => { setReassignOpen(false); setToUserId(""); }} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={reassign} disabled={busy || !toUserId}>
              {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {busy ? "Moving…" : `Move ${openLeadCount} lead${openLeadCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

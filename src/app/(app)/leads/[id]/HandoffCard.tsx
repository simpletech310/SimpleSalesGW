"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Role } from "@prisma/client";

type HandoffRow = {
  id: string;
  status: "DRAFT" | "INITIATED" | "ACCEPTED" | "REJECTED";
  notes: string | null;
  rejectedReason: string | null;
  initiatedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  initiator: { name: string };
  acceptor: { name: string } | null;
};

export function HandoffCard({ leadId, role }: { leadId: string; role: Role }) {
  const router = useRouter();
  const [items, setItems] = useState<HandoffRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  const canAccept = role === "COO" || role === "SUPERADMIN";

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}/handoffs`);
    const data = await res.json();
    if (res.ok) setItems(data.handoffs);
  }, [leadId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function decide(id: string, action: "accept" | "reject") {
    let body: Record<string, string> = {};
    if (action === "reject") {
      const reason = prompt("Why is this handoff being rejected? (required)");
      if (!reason) return;
      body = { reason };
    } else {
      const note = prompt("Optional acceptance note (or leave blank):") ?? undefined;
      if (note && note.trim()) body = { note: note.trim() };
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/handoffs/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed");
        return;
      }
      toast.success(action === "accept" ? "Handoff accepted" : "Handoff rejected");
      await refresh();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (items === null || items.length === 0) return null;

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gtn-navy mb-3">Sales → Ops handoff</h3>
      <ul className="divide-y divide-gtn-lavender-2">
        {items.map((h) => (
          <li key={h.id} className="py-3 space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <StatusPill status={h.status} />
                <p className="text-sm font-medium text-gtn-navy mt-1">
                  Initiated by {h.initiator.name}
                </p>
                <p className="text-xs text-gtn-grey-3">
                  {format(new Date(h.initiatedAt ?? h.createdAt), "PPp")}
                </p>
              </div>
              {h.status === "INITIATED" && canAccept && (
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => decide(h.id, "accept")}>
                    Accept handoff
                  </Button>
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => decide(h.id, "reject")}>
                    Reject
                  </Button>
                </div>
              )}
            </div>

            {h.notes && (
              <pre className="text-xs bg-gtn-lavender p-2 rounded whitespace-pre-wrap font-mono">{h.notes}</pre>
            )}

            {h.status === "ACCEPTED" && h.acceptor && (
              <p className="text-xs text-gtn-green">
                ✓ Accepted by {h.acceptor.name} · {h.acceptedAt ? format(new Date(h.acceptedAt), "PPp") : ""}
              </p>
            )}
            {h.status === "REJECTED" && (
              <div className="text-xs text-gtn-red">
                <p>
                  Rejected{h.acceptor ? ` by ${h.acceptor.name}` : ""} ·{" "}
                  {h.rejectedAt ? format(new Date(h.rejectedAt), "PPp") : ""}
                </p>
                {h.rejectedReason && <p className="mt-1"><strong>Reason:</strong> {h.rejectedReason}</p>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function StatusPill({ status }: { status: HandoffRow["status"] }) {
  const cls =
    status === "ACCEPTED" ? "bg-gtn-green-bg text-gtn-green"
      : status === "REJECTED" ? "bg-[#FBE9E7] text-gtn-red"
      : status === "INITIATED" ? "bg-[#FEF3E2] text-gtn-amber"
      : "bg-gtn-lavender text-gtn-grey-2";
  const label = status === "INITIATED" ? "Awaiting Ops" : status;
  return <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${cls}`}>{label}</span>;
}

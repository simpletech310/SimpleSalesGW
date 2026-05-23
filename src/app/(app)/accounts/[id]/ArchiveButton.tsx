"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CustomerStatus } from "@prisma/client";

type ArchiveStatus = typeof CustomerStatus.CHURNED | typeof CustomerStatus.PAUSED;
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, Textarea } from "@/components/ui/Input";

/**
 * ArchiveButton — flips a Customer to CHURNED or PAUSED with a required
 * reason. Visible to roles with the `customer:archive` permission only
 * (parent gates the render).
 */
export function ArchiveButton({
  customerId,
  customerName,
  alreadyArchived,
}: {
  customerId: string;
  customerName: string;
  alreadyArchived: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ArchiveStatus>(CustomerStatus.CHURNED);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (alreadyArchived) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold text-gtn-grey-2">
        Archived
      </span>
    );
  }

  async function submit() {
    if (!reason.trim()) {
      toast.error("Reason is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/accounts/${customerId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed");
        return;
      }
      toast.success(`${customerName} marked ${status}`);
      setOpen(false);
      setReason("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Archive
      </Button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gtn-navy/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <Card className="w-full max-w-md">
        <h3 className="text-sm font-semibold text-gtn-navy mb-3">Archive {customerName}?</h3>
        <p className="text-xs text-gtn-grey-2 mb-3">
          Archiving marks the customer inactive. The record stays in /accounts for history but
          is filtered out of operational views.
        </p>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Status *</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
            >
              <option value={CustomerStatus.CHURNED}>CHURNED — customer ended the engagement</option>
              <option value={CustomerStatus.PAUSED}>PAUSED — temporary hold, expected to resume</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Reason *</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What's driving this? (logged to audit trail)"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || !reason.trim()}>
            {submitting ? "Saving…" : `Mark ${status}`}
          </Button>
        </div>
      </Card>
    </div>
  );
}

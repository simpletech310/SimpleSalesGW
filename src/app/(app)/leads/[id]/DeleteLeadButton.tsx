"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Label, Textarea } from "@/components/ui/Input";

export function DeleteLeadButton({ leadId, businessName }: { leadId: string; businessName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Delete failed");
        return;
      }
      toast.success("Lead deleted");
      router.push("/leads");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Delete lead
      </Button>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-card max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gtn-navy">Delete {businessName}?</h2>
            <p className="text-sm text-gtn-grey-2 mt-1">
              This cascades to all activities, notes, assessments, attachments, and handoffs. Action is logged in the audit trail.
            </p>
            <form onSubmit={submit} className="space-y-3 mt-4">
              <div className="space-y-1">
                <Label className="text-xs">Reason *</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  required
                  placeholder="e.g. Duplicate of another lead, owner asked for removal, etc."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={saving || !reason.trim()}>
                  {saving ? "Deleting…" : "Delete permanently"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

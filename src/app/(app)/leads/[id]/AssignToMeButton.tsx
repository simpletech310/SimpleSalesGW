"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";

/**
 * v2.23.3 — One-click "Assign to me" button. Lives on the lead detail
 * page next to Edit/Discovery/etc. Visible only to roles that hold
 * `lead:assign` (SALES_MANAGER + SUPERADMIN — the API gate is the source
 * of truth; the button just trusts the parent's render condition).
 *
 * Why: the common scenario is a manager browsing unassigned leads or
 * leads owned by an off-rep and wanting to take ownership themselves
 * (or reassign to one of their reps via the existing /sales/assign UI).
 * Click → PATCH /api/leads/[id]/assign with their own userId → refresh.
 */
export function AssignToMeButton({
  leadId,
  currentOwnerName,
}: {
  leadId: string;
  currentOwnerName: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    const ok = window.confirm(
      currentOwnerName
        ? `This lead is currently owned by ${currentOwnerName}. Reassign it to yourself?`
        : "Take ownership of this lead?",
    );
    if (!ok) return;
    setBusy(true);
    try {
      // The server resolves "me" from the session; we PATCH the route
      // by reading session.user.id on the server. Send empty body — the
      // route reads ownerUserId from body, so we let the server's
      // helper endpoint resolve "self".
      const res = await fetch(`/api/leads/${leadId}/assign-to-me`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Reassignment failed");
        return;
      }
      toast.success("You now own this lead.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={onClick} disabled={busy}>
      {busy ? "Assigning…" : "Assign to me"}
    </Button>
  );
}

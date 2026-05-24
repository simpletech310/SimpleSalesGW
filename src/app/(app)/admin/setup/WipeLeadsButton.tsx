"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * v2.18 — Destructive wipe-all-leads button. SUPERADMIN-gated server-side.
 * Two-step confirm: first click arms, second click within 5s commits.
 * Mirrors the destructive-action pattern from the DeleteLeadButton.
 */
export function WipeLeadsButton() {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  function disarmSoon() {
    setArmed(true);
    setTimeout(() => setArmed(false), 5000);
  }

  async function run() {
    if (!armed) {
      disarmSoon();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/leads/wipe-all", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Wipe failed");
        return;
      }
      toast.success(
        `Wiped ${data.deletedLeads} lead${data.deletedLeads === 1 ? "" : "s"} (and cascaded children).`,
      );
      setArmed(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      onClick={run}
      disabled={busy}
      variant={armed ? "destructive" : "secondary"}
    >
      {busy ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Deleting…
        </>
      ) : armed ? (
        <>
          <Trash2 className="h-4 w-4 mr-2" />
          Click again within 5s to confirm
        </>
      ) : (
        <>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete ALL leads (irreversible)
        </>
      )}
    </Button>
  );
}

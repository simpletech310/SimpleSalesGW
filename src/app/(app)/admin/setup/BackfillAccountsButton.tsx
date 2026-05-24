"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * v2.15.2 — One-click recovery for orphaned accepted handoffs.
 * Finds every Handoff where status=ACCEPTED but no Customer row exists
 * for the lead, and creates the Customer for each via
 * POST /api/admin/customers/backfill-from-handoffs.
 */
export function BackfillAccountsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/customers/backfill-from-handoffs", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Backfill failed");
        return;
      }
      if (data.totalOrphans === 0) {
        toast.message("No orphaned accepted handoffs — every accepted handoff already has an Account.");
      } else if (data.failed > 0) {
        toast.warning(
          `Created ${data.created} accounts; ${data.failed} still failed (check logs).`,
          { duration: 8000 },
        );
      } else {
        toast.success(
          `Backfilled ${data.created} account${data.created === 1 ? "" : "s"} from orphaned handoffs.`,
        );
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backfill failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={run} disabled={busy} variant="secondary">
      {busy ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Scanning…
        </>
      ) : (
        <>
          <ShieldCheck className="h-4 w-4 mr-2" />
          Fix orphaned accounts
        </>
      )}
    </Button>
  );
}

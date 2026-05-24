"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * v2.14 — Client-side import trigger.
 * POSTs to /api/admin/prospects/import; surfaces a counts summary.
 */
export function ImportProspectsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/prospects/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Import failed");
        return;
      }
      if (data.created > 0) {
        toast.success(
          `Imported ${data.created} prospect${data.created === 1 ? "" : "s"} under ${data.ownerEmail}` +
            (data.skipped > 0 ? ` (${data.skipped} already existed).` : "."),
        );
      } else {
        toast.message(
          `All ${data.total} prospects already in the system — nothing to import.`,
        );
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={run} disabled={busy}>
      {busy ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Importing…
        </>
      ) : (
        <>
          <Download className="h-4 w-4 mr-2" />
          Import 25 starter prospects
        </>
      )}
    </Button>
  );
}

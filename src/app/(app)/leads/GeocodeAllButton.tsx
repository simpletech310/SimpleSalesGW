"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * v2.23.2 — Bulk-geocode any leads on this page that don't have
 * lat/lng yet. Self-healing for leads imported / created before
 * Mapbox was configured.
 */
export function GeocodeAllButton({ pendingCount }: { pendingCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/leads/geocode-all", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Geocoding failed");
        return;
      }
      const { geocoded, failed, teamAssigned, moreRemaining } = data;
      if (geocoded > 0) {
        const teamLine = teamAssigned > 0 ? ` · ${teamAssigned} auto-assigned to a team` : "";
        const failedLine = failed > 0 ? ` · ${failed} couldn't be geocoded` : "";
        const moreLine = moreRemaining ? " · more remain — click again" : "";
        toast.success(`Geocoded ${geocoded} lead${geocoded === 1 ? "" : "s"}${teamLine}${failedLine}${moreLine}`, {
          duration: 8000,
        });
      } else if (failed > 0) {
        toast.warning(`Couldn't geocode any leads — ${failed} addresses didn't resolve. Check city + state are set.`);
      } else {
        toast.message("Nothing to geocode — all leads with addresses already have pins.");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="secondary" onClick={run} disabled={busy}>
      {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <MapPin className="h-3.5 w-3.5 mr-1" />}
      {busy ? "Geocoding…" : `Geocode ${pendingCount} lead${pendingCount === 1 ? "" : "s"}`}
    </Button>
  );
}

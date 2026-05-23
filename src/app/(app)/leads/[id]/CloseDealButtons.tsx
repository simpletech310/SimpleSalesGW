"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PipelineStage } from "@prisma/client";
import { Button } from "@/components/ui/Button";

const TERMINAL_LABELS: Record<string, string> = {
  CLOSED_WON: "Closed Won",
  CLOSED_LOST: "Closed Lost",
  NURTURE: "Move to Nurture",
};

/**
 * Explicit terminal-stage controls on the Lead detail header.
 * Visible regardless of current stage — Lin can always close or move to nurture
 * (subject to non-strategic + RBAC guards in the API).
 */
export function CloseDealButtons({ leadId, currentStage }: { leadId: string; currentStage: PipelineStage }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (currentStage === PipelineStage.CLOSED_WON || currentStage === PipelineStage.CLOSED_LOST) {
    return (
      <span className="text-xs uppercase tracking-wide font-semibold text-gtn-grey-2">
        {currentStage === PipelineStage.CLOSED_WON ? "✓ Closed Won" : "Closed Lost"}
      </span>
    );
  }

  async function move(stage: PipelineStage, requireReason = false) {
    let reason: string | undefined;
    if (requireReason) {
      const r = prompt(
        stage === PipelineStage.CLOSED_LOST
          ? "Why was this deal lost? (required)"
          : "Optional note:",
      );
      if (stage === PipelineStage.CLOSED_LOST && !r) return;
      reason = r ?? undefined;
    }
    setBusy(true);
    try {
      let acknowledgeWarnings = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch(`/api/leads/${leadId}/stage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage, reason, acknowledgeWarnings }),
        });
        if (res.status === 409) {
          const data = await res.json();
          const warnings: string[] = data.warnings ?? [];
          const ok = window.confirm(
            `Phase gate warning before moving to ${TERMINAL_LABELS[stage] ?? stage}:\n\n` +
            warnings.map((w) => `• ${w}`).join("\n") +
            "\n\nProceed anyway?",
          );
          if (!ok) return;
          acknowledgeWarnings = true;
          continue;
        }
        const data = await res.json();
        if (!res.ok) {
          toast.error(data?.error ?? "Failed");
          return;
        }
        toast.success(`Moved to ${TERMINAL_LABELS[stage] ?? stage}`);
        router.refresh();
        return;
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="default"
        size="sm"
        disabled={busy}
        onClick={() => move(PipelineStage.CLOSED_WON)}
        className="bg-gtn-green hover:bg-gtn-green/90"
      >
        ✓ Closed Won
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => move(PipelineStage.CLOSED_LOST, true)}
      >
        Closed Lost
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => move(PipelineStage.NURTURE)}
      >
        Move to Nurture
      </Button>
    </div>
  );
}

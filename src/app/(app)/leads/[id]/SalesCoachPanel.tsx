"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Coach = {
  nextAction: string;
  why: string;
  talkTrack: string;
  riskFlags: string[];
  confidence: "high" | "medium" | "low";
};

/**
 * v2.22 — In-context AI sales coach for the rep working this deal.
 *
 * Click → POST /coach → Claude reads lead + last 20 activities + MSP
 * profile + qualification scorecard and returns next-best-action.
 * Cached as a ResearchArtifact server-side so a reload doesn't
 * re-spend tokens.
 */
export function SalesCoachPanel({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [coach, setCoach] = useState<Coach | null>(null);

  async function ask() {
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/coach`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) toast.error(data?.error ?? "AI budget exceeded for this lead.");
        else toast.error(data?.error ?? "Coaching failed");
        return;
      }
      setCoach({
        nextAction: data.nextAction ?? "",
        why: data.why ?? "",
        talkTrack: data.talkTrack ?? "",
        riskFlags: data.riskFlags ?? [],
        confidence: data.confidence ?? "low",
      });
      toast.success("Coach ready");
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-gtn-navy">AI sales coach</h3>
        <Button size="sm" onClick={ask} disabled={busy}>
          {busy
            ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Thinking…</>
            : <><Sparkles className="h-3.5 w-3.5 mr-1" /> {coach ? "Re-coach" : "Coach me on this deal"}</>
          }
        </Button>
      </div>
      <p className="text-xs text-gtn-grey-2 mb-3">
        Reads the last 20 activities + the company profile + the qualification scorecard,
        returns the next action with a talk-track grounded in real deal state.
      </p>

      {coach && (
        <div className="max-h-80 overflow-y-auto pr-1 space-y-3 rounded-md border border-gtn-lavender-2 bg-gtn-lavender/20 p-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-purple">Next action</p>
            <p className="text-sm text-gtn-navy mt-0.5">{coach.nextAction}</p>
          </div>
          {coach.why && (
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-purple">Why now</p>
              <p className="text-xs text-gtn-grey-2 mt-0.5 whitespace-pre-wrap">{coach.why}</p>
            </div>
          )}
          {coach.talkTrack && (
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-purple">Talk-track</p>
              <p className="text-sm text-gtn-navy italic mt-0.5 whitespace-pre-wrap">&ldquo;{coach.talkTrack}&rdquo;</p>
            </div>
          )}
          {coach.riskFlags.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-red flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Risk flags
              </p>
              <ul className="list-disc list-inside text-xs text-gtn-navy mt-0.5 space-y-0.5">
                {coach.riskFlags.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
          <p className="text-[10px] text-gtn-grey-3 pt-1 border-t border-gtn-lavender-2">
            Confidence: <strong className="uppercase">{coach.confidence}</strong>
          </p>
        </div>
      )}
    </Card>
  );
}

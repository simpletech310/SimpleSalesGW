"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Printer } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Brief = {
  openingLine: string;
  attendees: Array<{ name: string; role: string; why: string }>;
  questions: Array<{ question: string; rationale: string }>;
  risks: string[];
  successCriteria: string[];
};

/**
 * v2.20 — Discovery call prep brief.
 * Calls POST /api/leads/[id]/discovery-call-prep; renders the result
 * as a printable card the salesperson takes into the call.
 */
export function DiscoveryPrepButton({ leadId }: { leadId: string }) {
  const [busy, setBusy] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/discovery-call-prep`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Prep generation failed");
        return;
      }
      setBrief({
        openingLine: data.openingLine ?? "",
        attendees: data.attendees ?? [],
        questions: data.questions ?? [],
        risks: data.risks ?? [],
        successCriteria: data.successCriteria ?? [],
      });
      toast.success("Prep brief ready");
    } catch {
      toast.error("Prep generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-gtn-navy">AI prep brief</h2>
          <p className="text-xs text-gtn-grey-2">60-second scan before the call — questions tailored to this lead.</p>
        </div>
        <div className="flex items-center gap-2">
          {brief && (
            <Button size="sm" variant="ghost" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5 mr-1" />
              Print
            </Button>
          )}
          <Button size="sm" onClick={generate} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                Thinking…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                {brief ? "Regenerate" : "Generate prep brief"}
              </>
            )}
          </Button>
        </div>
      </div>

      {brief && (
        <Card>
          {brief.openingLine && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-purple">Opening line</p>
              <p className="text-sm text-gtn-navy italic">&ldquo;{brief.openingLine}&rdquo;</p>
            </div>
          )}

          {brief.attendees.length > 0 && (
            <div className="space-y-1 mt-4">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-purple">Attendees to look up</p>
              <ul className="space-y-1">
                {brief.attendees.map((a, i) => (
                  <li key={i} className="text-sm text-gtn-navy">
                    <strong>{a.name}</strong>
                    {a.role && <span className="text-gtn-grey-2"> · {a.role}</span>}
                    {a.why && <span className="block text-xs text-gtn-grey-2 ml-2">— {a.why}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {brief.questions.length > 0 && (
            <div className="space-y-1 mt-4">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-purple">
                Questions ({brief.questions.length})
              </p>
              <ol className="space-y-2 list-decimal list-inside">
                {brief.questions.map((q, i) => (
                  <li key={i} className="text-sm text-gtn-navy">
                    {q.question}
                    {q.rationale && (
                      <span className="block ml-5 text-[11px] italic text-gtn-grey-2">why: {q.rationale}</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {brief.risks.length > 0 && (
            <div className="space-y-1 mt-4">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-red">Listen for</p>
              <ul className="space-y-1 list-disc list-inside text-sm text-gtn-navy">
                {brief.risks.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}

          {brief.successCriteria.length > 0 && (
            <div className="space-y-1 mt-4">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-purple">Call is a win if</p>
              <ul className="space-y-1 list-disc list-inside text-sm text-gtn-navy">
                {brief.successCriteria.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

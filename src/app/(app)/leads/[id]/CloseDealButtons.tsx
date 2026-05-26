"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PipelineStage } from "@prisma/client";
import { CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";

type Outcome = "CLOSED_WON" | "CLOSED_LOST";
type PrimaryReason = "PRICE" | "SCOPE" | "TIMING" | "TRUST" | "RELATIONSHIP" | "INCUMBENT" | "OTHER";
const REASONS: PrimaryReason[] = ["PRICE", "SCOPE", "TIMING", "TRUST", "RELATIONSHIP", "INCUMBENT", "OTHER"];

/**
 * v3.3 — Close-deal controls now wrap a mandatory debrief blocker on
 * CLOSED_WON / CLOSED_LOST (SOP Step 10). AI-assisted draft via #8.
 */
export function CloseDealButtons({ leadId, currentStage }: { leadId: string; currentStage: PipelineStage }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [debriefFor, setDebriefFor] = useState<Outcome | null>(null);

  if (currentStage === PipelineStage.CLOSED_WON || currentStage === PipelineStage.CLOSED_LOST) {
    return (
      <span className="text-xs uppercase tracking-wide font-semibold text-ink-muted inline-flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-gtn-green" />
        {currentStage === PipelineStage.CLOSED_WON ? "Closed Won" : "Closed Lost"}
      </span>
    );
  }

  async function moveNurture() {
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: PipelineStage.NURTURE }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed");
        return;
      }
      toast.success("Moved to Nurture");
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => setDebriefFor("CLOSED_WON")}
          className="border-gtn-green/40 text-gtn-green hover:bg-gtn-green hover:text-white hover:border-gtn-green focus-visible:bg-gtn-green focus-visible:text-white"
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          Closed Won
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => setDebriefFor("CLOSED_LOST")}
          className="border-gtn-red/40 text-gtn-red hover:bg-gtn-red hover:text-white hover:border-gtn-red focus-visible:bg-gtn-red focus-visible:text-white"
        >
          <X className="h-3.5 w-3.5 mr-1.5" />
          Closed Lost
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={moveNurture}
          className="border-gtn-purple/40 text-gtn-purple hover:bg-gtn-purple hover:text-white hover:border-gtn-purple focus-visible:bg-gtn-purple focus-visible:text-white"
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          Move to Nurture
        </Button>
      </div>

      {debriefFor && (
        <DebriefBlocker
          leadId={leadId}
          outcome={debriefFor}
          onCancel={() => setDebriefFor(null)}
          onSubmitted={() => {
            setDebriefFor(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function DebriefBlocker({
  leadId,
  outcome,
  onCancel,
  onSubmitted,
}: {
  leadId: string;
  outcome: Outcome;
  onCancel: () => void;
  onSubmitted: () => void;
}) {
  const [primaryReason, setPrimaryReason] = useState<PrimaryReason>("OTHER");
  const [whatWorked, setWhatWorked] = useState("");
  const [objectionResolved, setObjectionResolved] = useState("");
  const [templateThatWon, setTemplateThatWon] = useState("");
  const [whatBroke, setWhatBroke] = useState("");
  const [playbookUpdate, setPlaybookUpdate] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  // raw AI suggestion stored for "did rep agree?" analytics
  const [aiJson, setAiJson] = useState<unknown>(null);

  async function aiDraft() {
    setAiBusy(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/debrief/ai-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.detail ?? "AI unavailable");
        return;
      }
      const v = data.value as {
        primaryReason: PrimaryReason; whatWorked: string; objectionResolved: string;
        templateThatWon: string; whatBroke: string; playbookUpdate: string;
      };
      setPrimaryReason(v.primaryReason);
      setWhatWorked(v.whatWorked);
      setObjectionResolved(v.objectionResolved);
      setTemplateThatWon(v.templateThatWon);
      setWhatBroke(v.whatBroke);
      setPlaybookUpdate(v.playbookUpdate);
      setAiJson(v);
      toast.success("AI debrief drafted — edit before submitting");
    } finally { setAiBusy(false); }
  }

  async function submit() {
    if (!playbookUpdate.trim()) {
      toast.error("Playbook update is required.");
      return;
    }
    setBusy(true);
    try {
      // 1. Save the debrief
      const debriefRes = await fetch(`/api/leads/${leadId}/debrief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome,
          primaryReason,
          whatWorked: outcome === "CLOSED_WON" ? whatWorked : undefined,
          objectionResolved: outcome === "CLOSED_WON" ? objectionResolved : undefined,
          templateThatWon: outcome === "CLOSED_WON" ? templateThatWon : undefined,
          whatBroke: outcome === "CLOSED_LOST" ? whatBroke : undefined,
          playbookUpdate,
          aiSuggestedJson: aiJson,
        }),
      });
      const debriefData = await debriefRes.json();
      if (!debriefRes.ok) {
        toast.error(debriefData?.error ?? "Debrief save failed");
        return;
      }
      // 2. Flip the stage with the primary reason as the closedLostReason fallback
      const stageRes = await fetch(`/api/leads/${leadId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: outcome,
          reason: outcome === "CLOSED_LOST" ? `${primaryReason}${whatBroke ? `: ${whatBroke.slice(0, 200)}` : ""}` : undefined,
          acknowledgeWarnings: true,
        }),
      });
      if (!stageRes.ok) {
        const data = await stageRes.json();
        toast.error(data?.error ?? "Stage move failed");
        return;
      }
      toast.success(`Moved to ${outcome.toLowerCase().replace("_", " ")} + debrief saved`);
      onSubmitted();
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl border border-line-subtle max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-line-subtle flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink-strong">
              Debrief before closing {outcome === "CLOSED_WON" ? "won" : "lost"}
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Required. Every deal — won or lost — feeds the playbook. Click <strong>Draft with AI</strong> to
              auto-fill from activities + objections + pricing, then edit.
            </p>
          </div>
          <button onClick={onCancel} disabled={busy} className="text-ink-muted hover:text-ink-strong p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" onClick={aiDraft} disabled={aiBusy || busy}>
              {aiBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
              Draft with AI
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Primary reason <span className="text-danger">*</span></Label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setPrimaryReason(r)}
                  className={`text-xs px-2 py-2 rounded-md border font-medium transition-colors ${
                    primaryReason === r
                      ? "bg-gtn-purple text-white border-gtn-purple"
                      : "border-line-subtle hover:border-line-strong text-ink-muted"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {outcome === "CLOSED_WON" ? (
            <>
              <div className="space-y-1.5">
                <Label>What worked</Label>
                <Textarea rows={3} value={whatWorked} onChange={(e) => setWhatWorked(e.target.value)}
                  placeholder="Specifically what drove the yes — moment of decision, the line that landed, the proof point that mattered." />
              </div>
              <div className="space-y-1.5">
                <Label>Objection resolved</Label>
                <Textarea rows={2} value={objectionResolved} onChange={(e) => setObjectionResolved(e.target.value)}
                  placeholder="Which top objection did you flip + how." />
              </div>
              <div className="space-y-1.5">
                <Label>Outreach template that won the meeting</Label>
                <Input value={templateThatWon} onChange={(e) => setTemplateThatWon(e.target.value)}
                  placeholder="Template name from /admin/outreach if known" />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label>What broke</Label>
              <Textarea rows={4} value={whatBroke} onChange={(e) => setWhatBroke(e.target.value)}
                placeholder="Specifically what killed the deal. Be honest — this is for learning, not blame." />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Playbook update <span className="text-danger">*</span></Label>
            <Textarea rows={3} value={playbookUpdate} onChange={(e) => setPlaybookUpdate(e.target.value)}
              placeholder="What to tweak in objections / outreach / scoring based on this deal. The Sales Manager reads these monthly." />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-line-subtle flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={busy || !playbookUpdate.trim()}>
            {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Submit + close as {outcome === "CLOSED_WON" ? "won" : "lost"}
          </Button>
        </div>
      </div>
    </div>
  );
}

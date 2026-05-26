"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Calendar, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

type Kickoff = {
  id: string;
  scheduledAt: string | null;
  completedAt: string | null;
  relationshipNarrative: string | null;
  decisionMakerRecap: string | null;
  day30CommitmentRecap: string | null;
  salesAttended: boolean;
  vcioAttended: boolean;
  notes: string | null;
  aiDraftedAt: string | null;
};

type AiDraft = {
  paragraphPeople: string;
  paragraphBusiness: string;
  paragraphCommitment: string;
  speakerNotes?: string[];
};

/**
 * v3.3 — Kickoff panel. SOP Step 9: salesperson does the warm hand-off
 * narrative at Day 1, then vCIO takes the relationship.
 */
export function KickoffPanel({ customerId }: { customerId: string }) {
  const [k, setK] = useState<Kickoff | null>(null);
  const [draft, setDraft] = useState<Partial<Kickoff>>({});
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/customers/${customerId}/kickoff`);
    if (!res.ok) return;
    const data = await res.json();
    setK(data.kickoff);
  }, [customerId]);

  useEffect(() => { void load(); }, [load]);

  async function save(patch: Partial<Kickoff>, ai?: AiDraft) {
    setBusy(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/kickoff`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ai ? { ...patch, aiDraftJson: ai } : patch),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Save failed");
        return;
      }
      toast.success("Saved");
      setK(data.kickoff);
      setDraft({});
    } finally { setBusy(false); }
  }

  async function aiDraft() {
    setAiBusy(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/kickoff/ai-narrative`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.detail ?? "AI unavailable");
        return;
      }
      const ai = data.value as AiDraft;
      const combined = [ai.paragraphPeople, ai.paragraphBusiness, ai.paragraphCommitment].join("\n\n");
      setDraft({ relationshipNarrative: combined });
      // Save AI provenance + draft together
      await save({ relationshipNarrative: combined }, ai);
      toast.success("AI narrative drafted — review + polish before the meeting");
    } finally { setAiBusy(false); }
  }

  if (k === null) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-ink-muted">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading kickoff…
      </div>
    );
  }

  const narrative = draft.relationshipNarrative ?? k.relationshipNarrative ?? "";
  const decisionRecap = draft.decisionMakerRecap ?? k.decisionMakerRecap ?? "";
  const commitRecap = draft.day30CommitmentRecap ?? k.day30CommitmentRecap ?? "";
  const notes = draft.notes ?? k.notes ?? "";
  const dirty = Object.keys(draft).length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-ink-strong inline-flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gtn-purple" /> Day-1 kickoff
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Salesperson does the warm-handoff narrative + intros, then vCIO takes the relationship.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {k.completedAt ? (
              <Badge tone="success" shape="pill" size="xs" dot>completed</Badge>
            ) : k.scheduledAt ? (
              <Badge tone="brand" shape="pill" size="xs">scheduled</Badge>
            ) : (
              <Badge tone="warn" shape="pill" size="xs">unscheduled</Badge>
            )}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <div className="space-y-1.5">
            <Label>Scheduled at</Label>
            <Input
              type="datetime-local"
              value={k.scheduledAt ? k.scheduledAt.slice(0, 16) : ""}
              onChange={(e) => save({ scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Completed at</Label>
            <Input
              type="datetime-local"
              value={k.completedAt ? k.completedAt.slice(0, 16) : ""}
              onChange={(e) => save({ completedAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
            />
          </div>
        </div>
      </div>

      {/* Narrative */}
      <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-ink-strong">Relationship narrative</h3>
            <p className="text-[11px] text-ink-faint">
              Three paragraphs: who we met · the business context · what we committed to.
              Delivered at the top of the kickoff meeting.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={aiDraft} disabled={aiBusy || busy}>
            {aiBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
            Draft with AI
          </Button>
        </div>
        <Textarea
          rows={10}
          value={narrative}
          onChange={(e) => setDraft((d) => ({ ...d, relationshipNarrative: e.target.value }))}
          placeholder="Draft empty or click 'Draft with AI' to seed from discovery + handoff."
        />
        {k.aiDraftedAt && (
          <p className="text-[10px] text-ink-faint">
            ✨ AI-drafted {new Date(k.aiDraftedAt).toLocaleString()} — edited content is yours
          </p>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface border border-line-subtle p-4 space-y-2">
          <Label>Decision-maker recap</Label>
          <Textarea
            rows={4}
            value={decisionRecap}
            onChange={(e) => setDraft((d) => ({ ...d, decisionMakerRecap: e.target.value }))}
            placeholder="Who has final say. Who pushed back during the sales cycle. Who became a champion."
          />
        </div>
        <div className="rounded-xl bg-surface border border-line-subtle p-4 space-y-2">
          <Label>Day-30 commitment recap</Label>
          <Textarea
            rows={4}
            value={commitRecap}
            onChange={(e) => setDraft((d) => ({ ...d, day30CommitmentRecap: e.target.value }))}
            placeholder="What we promised the customer will see in the first 30 days."
          />
        </div>
      </div>

      <div className="rounded-xl bg-surface border border-line-subtle p-4 space-y-3">
        <h3 className="text-sm font-semibold text-ink-strong">Meeting attendance</h3>
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-ink-strong cursor-pointer">
            <input
              type="checkbox"
              checked={k.salesAttended}
              onChange={(e) => save({ salesAttended: e.target.checked })}
              className="accent-gtn-purple h-4 w-4"
            />
            <CheckCircle2 className="h-3.5 w-3.5 text-gtn-green" />
            Salesperson attended
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-ink-strong cursor-pointer">
            <input
              type="checkbox"
              checked={k.vcioAttended}
              onChange={(e) => save({ vcioAttended: e.target.checked })}
              className="accent-gtn-purple h-4 w-4"
            />
            <CheckCircle2 className="h-3.5 w-3.5 text-gtn-green" />
            vCIO attended
          </label>
        </div>
      </div>

      <div className="rounded-xl bg-surface border border-line-subtle p-4 space-y-2">
        <Label>Notes</Label>
        <Textarea
          rows={3}
          value={notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          placeholder="Anything that surprised you at the kickoff — log it for next time."
        />
      </div>

      {dirty && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={() => save(draft)} disabled={busy}>
            {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save changes
          </Button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";

const PRE_CALL_CHECKS = [
  { key: "research_done",             label: "LinkedIn + website + Google Business reviewed" },
  { key: "claude_summary",            label: "Claude research summary read or generated" },
  { key: "decision_maker_confirmed",  label: "Decision-maker / sponsor confirmed on the invite" },
  { key: "agenda_sent",               label: "Agenda + outcomes sent ≥24h ahead" },
  { key: "calendar_blocked",          label: "60-minute block (45 + 15 buffer)" },
  { key: "objection_review",          label: "Industry objections + rebuttals scanned" },
] as const;

type Commitment = { text: string; ownerName?: string; dueAt?: string };
type RedFlag = { text: string; severity: "high" | "medium" | "low" };

export function DiscoveryCallForm({ leadId, contactName }: { leadId: string; contactName: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Pre-call checklist
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  // Logistics
  const [conductedAt, setConductedAt] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [durationMinutes, setDurationMinutes] = useState<number>(45);

  // Section notes
  const [openingNotes, setOpeningNotes] = useState("");
  const [businessNotes, setBusinessNotes] = useState("");
  const [techNotes, setTechNotes] = useState("");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [miniPitchNotes, setMiniPitchNotes] = useState("");
  const [closeNotes, setCloseNotes] = useState("");

  // Outputs
  const [nextStep, setNextStep] = useState("");
  const [nextStepDueAt, setNextStepDueAt] = useState("");

  const [commitments, setCommitments] = useState<Commitment[]>([{ text: "" }]);
  const [redFlags, setRedFlags] = useState<RedFlag[]>([{ text: "", severity: "medium" }]);

  const checklistTotal = PRE_CALL_CHECKS.length;
  const checklistDone = PRE_CALL_CHECKS.filter((c) => checklist[c.key]).length;

  function setCommit(idx: number, patch: Partial<Commitment>) {
    setCommitments((cur) => cur.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function setFlag(idx: number, patch: Partial<RedFlag>) {
    setRedFlags((cur) => cur.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function save() {
    if (!businessNotes.trim() && !techNotes.trim() && !decisionNotes.trim() && !nextStep.trim()) {
      toast.error("Add at least one substantive note or next step.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/discovery-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conductedAt: new Date(conductedAt).toISOString(),
          durationMinutes,
          openingNotes:   openingNotes.trim() || undefined,
          businessNotes:  businessNotes.trim() || undefined,
          techNotes:      techNotes.trim() || undefined,
          decisionNotes:  decisionNotes.trim() || undefined,
          miniPitchNotes: miniPitchNotes.trim() || undefined,
          closeNotes:     closeNotes.trim() || undefined,
          nextStep:       nextStep.trim() || undefined,
          nextStepDueAt:  nextStepDueAt ? new Date(nextStepDueAt).toISOString() : undefined,
          commitments:    commitments.filter((c) => c.text.trim()),
          redFlags:       redFlags.filter((r) => r.text.trim()),
          preCallChecklist: checklist,
        }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data?.error ?? "Save failed");
      else {
        toast.success("Discovery call saved");
        router.push(`/leads/${leadId}`);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Pre-call prep */}
      <Card>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gtn-navy">Pre-call prep checklist</h2>
          <p className="text-xs text-gtn-grey-2">
            <span className="font-mono">{checklistDone}/{checklistTotal}</span> complete
          </p>
        </div>
        <ul className="space-y-1">
          {PRE_CALL_CHECKS.map((c) => (
            <li key={c.key}>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={!!checklist[c.key]}
                  onChange={(e) => setChecklist((s) => ({ ...s, [c.key]: e.target.checked }))}
                />
                <span className={checklist[c.key] ? "line-through text-gtn-grey-2" : ""}>{c.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </Card>

      {/* Logistics */}
      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Call</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">When</Label>
            <Input type="datetime-local" value={conductedAt} onChange={(e) => setConductedAt(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Duration (min)</Label>
            <Input type="number" min={5} max={720} value={durationMinutes}
              onChange={(e) => setDurationMinutes(Math.max(5, Number(e.target.value) || 45))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Primary contact</Label>
            <Input value={contactName} disabled />
          </div>
        </div>
      </Card>

      {/* Section notes */}
      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Opening (5 min)</h2>
        <p className="text-xs text-gtn-grey-2 mb-2">
          Confirm timing, restate agenda, anchor outcome. Capture any tone signals.
        </p>
        <Textarea rows={3} value={openingNotes} onChange={(e) => setOpeningNotes(e.target.value)} />
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Business questions (10 min)</h2>
        <p className="text-xs text-gtn-grey-2 mb-2">
          {"What's the business, who's it for, what's working / not working today, what's the cost of inaction?"}
        </p>
        <Textarea rows={6} value={businessNotes} onChange={(e) => setBusinessNotes(e.target.value)} />
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Tech questions (10 min)</h2>
        <p className="text-xs text-gtn-grey-2 mb-2">
          {"Identity, endpoints, network, cloud, backup, security stack. Where's the duct tape?"}
        </p>
        <Textarea rows={6} value={techNotes} onChange={(e) => setTechNotes(e.target.value)} />
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Decision questions (5 min)</h2>
        <p className="text-xs text-gtn-grey-2 mb-2">
          {"Who decides? Who influences? Budget? Timeline / compelling event? What's blocking?"}
        </p>
        <Textarea rows={4} value={decisionNotes} onChange={(e) => setDecisionNotes(e.target.value)} />
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Mini-pitch (5 min)</h2>
        <p className="text-xs text-gtn-grey-2 mb-2">
          Two-sentence positioning + 2 sample wins relevant to what they said. Capture their reaction.
        </p>
        <Textarea rows={3} value={miniPitchNotes} onChange={(e) => setMiniPitchNotes(e.target.value)} />
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Close (5 min)</h2>
        <p className="text-xs text-gtn-grey-2 mb-2">
          Recap, propose next step, get a calendar commitment.
        </p>
        <Textarea rows={3} value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} />
      </Card>

      {/* Outputs */}
      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Next step</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">{"What's next?"}</Label>
            <Input value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="e.g. Send proposal by Friday" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Due</Label>
            <Input type="date" value={nextStepDueAt} onChange={(e) => setNextStepDueAt(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Commitments captured</h2>
        <div className="space-y-2">
          {commitments.map((c, idx) => (
            <div key={idx} className="grid sm:grid-cols-12 gap-2">
              <Input
                className="sm:col-span-6"
                value={c.text}
                onChange={(e) => setCommit(idx, { text: e.target.value })}
                placeholder="Commitment text"
              />
              <Input
                className="sm:col-span-3"
                value={c.ownerName ?? ""}
                onChange={(e) => setCommit(idx, { ownerName: e.target.value })}
                placeholder="Owner"
              />
              <Input
                className="sm:col-span-3"
                type="date"
                value={c.dueAt ?? ""}
                onChange={(e) => setCommit(idx, { dueAt: e.target.value })}
              />
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setCommitments((cur) => [...cur, { text: "" }])}>
            + Add commitment
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Red flags</h2>
        <div className="space-y-2">
          {redFlags.map((r, idx) => (
            <div key={idx} className="grid sm:grid-cols-12 gap-2">
              <Input
                className="sm:col-span-9"
                value={r.text}
                onChange={(e) => setFlag(idx, { text: e.target.value })}
                placeholder="What concerned you?"
              />
              <select
                className="sm:col-span-3 flex h-10 rounded-md border border-input bg-white px-3 text-sm"
                value={r.severity}
                onChange={(e) => setFlag(idx, { severity: e.target.value as RedFlag["severity"] })}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setRedFlags((cur) => [...cur, { text: "", severity: "medium" }])}>
            + Add red flag
          </Button>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push(`/leads/${leadId}`)} disabled={saving}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save call notes"}</Button>
      </div>
    </div>
  );
}

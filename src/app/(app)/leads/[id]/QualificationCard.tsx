"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import type { QualificationVerdict } from "@prisma/client";
import {
  MAX_TOTAL,
  QUALIFICATION_DIMENSIONS,
  VERDICT_BLURB,
  VERDICT_LABEL,
  computeTotal,
  verdictFor,
  type QualificationDimensionKey,
  type QualificationInput,
} from "@/lib/qualification";

type ScorecardRow = {
  id: string;
  industryFit: number;
  sizeFit: number;
  geography: number;
  growthPosture: number;
  authority: number;
  budget: number;
  timeline: number;
  complianceDriver: number;
  total: number;
  verdict: QualificationVerdict | null;
  reasonCodes: string[];
  notes: string | null;
  scoredAt: string | null;
  scoredBy: { id: string; name: string; email: string } | null;
};

const VERDICT_COLOR: Record<QualificationVerdict, string> = {
  LIGHTHOUSE: "bg-gtn-green-bg text-gtn-green",
  STRONG_FIT: "bg-gtn-lavender text-gtn-navy",
  MARGINAL:   "bg-[#FEF3E2] text-gtn-amber",
  REFER:      "bg-gtn-lavender text-gtn-grey-2",
  DECLINE:    "bg-[#FBE9E7] text-gtn-red",
};

const REASON_CODE_PRESETS = [
  "Decision-maker engaged",
  "Renewal event in <90d",
  "Active breach",
  "Cyber insurance driver",
  "HIPAA / PCI / CMMC",
  "Out-of-band seat count",
  "Outside Houston metro",
  "Budget unclear",
  "Authority unclear",
  "Incumbent locked in",
];

export function QualificationCard({
  leadId,
  canEdit,
}: {
  leadId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [card, setCard] = useState<ScorecardRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Draft state
  const [values, setValues] = useState<Record<QualificationDimensionKey, number>>({
    industryFit: 0, sizeFit: 0, geography: 0, growthPosture: 0,
    authority: 0, budget: 0, timeline: 0, complianceDriver: 0,
  });
  const [reasonCodes, setReasonCodes] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}/qualification`);
    if (res.ok) {
      const data = await res.json();
      setCard(data.qualification);
    }
    setLoading(false);
  }, [leadId]);

  useEffect(() => { void refresh(); }, [refresh]);

  function startEditing() {
    if (card) {
      setValues({
        industryFit: card.industryFit, sizeFit: card.sizeFit, geography: card.geography,
        growthPosture: card.growthPosture, authority: card.authority, budget: card.budget,
        timeline: card.timeline, complianceDriver: card.complianceDriver,
      });
      setReasonCodes(new Set(card.reasonCodes));
      setNotes(card.notes ?? "");
    } else {
      setValues({
        industryFit: 0, sizeFit: 0, geography: 0, growthPosture: 0,
        authority: 0, budget: 0, timeline: 0, complianceDriver: 0,
      });
      setReasonCodes(new Set());
      setNotes("");
    }
    setEditing(true);
  }

  const previewTotal = useMemo(() => computeTotal(values as Partial<QualificationInput>), [values]);
  const previewVerdict = useMemo(() => verdictFor(previewTotal), [previewTotal]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/qualification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          reasonCodes: Array.from(reasonCodes),
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data?.error ?? "Save failed");
      else {
        toast.success("Qualification saved");
        setEditing(false);
        await refresh();
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gtn-navy">Qualification scorecard</h3>
          <p className="text-xs text-gtn-grey-2 mt-0.5">
            {"Salesperson's manual fit assessment. Complementary to the engine's auto-computed Customer Score."}
          </p>
        </div>
        {canEdit && (
          <Button
            variant={card ? "ghost" : "secondary"}
            size="sm"
            onClick={() => (editing ? setEditing(false) : startEditing())}
          >
            {editing ? "Cancel" : card ? "Edit" : "Score this lead"}
          </Button>
        )}
      </div>

      {!editing && !card && (
        <p className="text-sm text-gtn-grey-2">
          Not scored yet. {canEdit ? "Click \"Score this lead\" to fill in the 8-dimension scorecard." : ""}
        </p>
      )}

      {!editing && card && (
        <>
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-4xl font-mono font-bold text-gtn-navy">
                {card.total} <span className="text-base text-gtn-grey-2">/ {MAX_TOTAL}</span>
              </p>
            </div>
            {card.verdict && (
              <div>
                <span className={`inline-block text-xs font-semibold uppercase tracking-wide rounded-full px-3 py-1 ${VERDICT_COLOR[card.verdict]}`}>
                  {VERDICT_LABEL[card.verdict]}
                </span>
                <p className="text-xs text-gtn-grey-2 mt-1">{VERDICT_BLURB[card.verdict]}</p>
              </div>
            )}
          </div>

          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {QUALIFICATION_DIMENSIONS.map((d) => (
              <div key={d.key} className="rounded border border-gtn-lavender-2 p-2">
                <p className="text-[10px] uppercase tracking-wide text-gtn-grey-2">{d.label}</p>
                <p className="text-lg font-mono font-semibold text-gtn-navy">
                  {card[d.key as keyof ScorecardRow] as number}<span className="text-xs text-gtn-grey-2">/{d.max}</span>
                </p>
              </div>
            ))}
          </div>

          {card.reasonCodes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {card.reasonCodes.map((r) => (
                <span key={r} className="text-[11px] bg-gtn-lavender text-gtn-navy rounded px-2 py-0.5">{r}</span>
              ))}
            </div>
          )}
          {card.notes && (
            <p className="text-xs text-gtn-grey-2 mt-3 whitespace-pre-wrap">{card.notes}</p>
          )}
          {card.scoredAt && card.scoredBy && (
            <p className="text-[11px] text-gtn-grey-3 mt-3">
              Scored by {card.scoredBy.name} · {format(new Date(card.scoredAt), "PPp")}
            </p>
          )}
        </>
      )}

      {editing && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            {QUALIFICATION_DIMENSIONS.map((d) => (
              <div key={d.key} className="space-y-1">
                <Label className="text-xs flex justify-between">
                  <span>{d.label}</span>
                  <span className="text-gtn-grey-2 font-mono">
                    {values[d.key as QualificationDimensionKey]}/{d.max}
                  </span>
                </Label>
                <Input
                  type="range"
                  min={0}
                  max={d.max}
                  step={1}
                  value={values[d.key as QualificationDimensionKey]}
                  onChange={(e) =>
                    setValues((s) => ({ ...s, [d.key]: Math.min(d.max, Math.max(0, Number(e.target.value))) }))
                  }
                  className="h-6 p-0"
                />
                <p className="text-[10px] text-gtn-grey-2">{d.help}</p>
              </div>
            ))}
          </div>

          <div className="rounded-md bg-gtn-lavender p-3 flex items-center gap-3 flex-wrap">
            <p className="text-3xl font-mono font-bold text-gtn-navy">
              {previewTotal} <span className="text-sm text-gtn-grey-2">/ {MAX_TOTAL}</span>
            </p>
            <div>
              <span className={`inline-block text-xs font-semibold uppercase tracking-wide rounded-full px-3 py-1 ${VERDICT_COLOR[previewVerdict]}`}>
                {VERDICT_LABEL[previewVerdict]}
              </span>
              <p className="text-xs text-gtn-grey-2 mt-1">{VERDICT_BLURB[previewVerdict]}</p>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Reason codes (optional)</Label>
            <div className="flex flex-wrap gap-1.5">
              {REASON_CODE_PRESETS.map((r) => {
                const on = reasonCodes.has(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() =>
                      setReasonCodes((s) => {
                        const next = new Set(s);
                        if (next.has(r)) next.delete(r); else next.add(r);
                        return next;
                      })
                    }
                    className={`text-[11px] rounded px-2 py-0.5 border ${
                      on
                        ? "bg-gtn-purple text-white border-gtn-purple"
                        : "bg-white text-gtn-grey-2 border-gtn-lavender-2 hover:border-gtn-purple"
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save scorecard"}</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

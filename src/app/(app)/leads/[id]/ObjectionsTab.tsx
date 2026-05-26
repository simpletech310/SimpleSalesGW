"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { OBJECTION_CATEGORIES } from "@/lib/objections/defaults";

/**
 * v2.20 — Claude rebuttal payload shape (returned by
 * POST /api/leads/[id]/objections/[logId]/coach).
 */
type Rebuttal = { rebuttal: string; why: string; tone: string };
type CoachResult = { rebuttals: Rebuttal[]; ifEscalated: string };

type Template = {
  id: string;
  category: string;
  industry: string | null;
  trigger: string;
  rebuttal: string;
  source: string | null;
};

type Log = {
  id: string;
  category: string;
  text: string;
  rebuttalUsed: string | null;
  outcome: string | null;
  raisedAt: string;
  raisedBy: { id: string; name: string };
  template: Template | null;
};

const OUTCOME_OPTIONS = ["", "RESOLVED", "ESCALATED", "OPEN"];

export function ObjectionsTab({ leadId, canEdit }: { leadId: string; canEdit: boolean }) {
  const router = useRouter();
  const [logs, setLogs] = useState<Log[]>([]);
  const [reference, setReference] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState<string>("PRICE");
  const [referenceFilter, setReferenceFilter] = useState<string>("");
  const [text, setText] = useState("");
  const [rebuttalUsed, setRebuttalUsed] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  // v2.20 — per-log coaching state (which log is busy + cached result)
  const [coachingId, setCoachingId] = useState<string | null>(null);
  const [coachResults, setCoachResults] = useState<Record<string, CoachResult>>({});

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}/objections`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs);
      setReference(data.reference);
    }
    setLoading(false);
  }, [leadId]);

  useEffect(() => { void refresh(); }, [refresh]);

  function pickTemplate(t: Template) {
    setCategory(t.category);
    setText(t.trigger);
    setRebuttalUsed(t.rebuttal);
    setTemplateId(t.id);
    setAdding(true);
  }

  async function save() {
    if (!text.trim()) { toast.error("Enter the objection text."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/objections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          text,
          rebuttalUsed: rebuttalUsed.trim() ? rebuttalUsed : null,
          templateId: templateId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? "Save failed"); return; }
      setLogs((cur) => [data.log, ...cur]);
      setText(""); setRebuttalUsed(""); setTemplateId(""); setAdding(false);
      toast.success("Objection logged");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function updateOutcome(id: string, outcome: string) {
    const res = await fetch(`/api/leads/${leadId}/objections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: outcome || null }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error ?? "Update failed");
      return;
    }
    setLogs((cur) => cur.map((l) => (l.id === id ? { ...l, outcome: outcome || null } : l)));
  }

  async function coach(logId: string) {
    setCoachingId(logId);
    try {
      const res = await fetch(`/api/leads/${leadId}/objections/${logId}/coach`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          toast.error(data?.error ?? "AI budget exceeded for this lead.");
        } else {
          toast.error(data?.error ?? "Coaching failed");
        }
        return;
      }
      setCoachResults((cur) => ({
        ...cur,
        [logId]: { rebuttals: data.rebuttals ?? [], ifEscalated: data.ifEscalated ?? "" },
      }));
      toast.success(`Generated ${data.rebuttals?.length ?? 0} rebuttals`);
      // v2.20.3 — refresh server components so the AI usage meter updates
      router.refresh();
    } catch {
      toast.error("Coaching failed");
    } finally {
      setCoachingId(null);
    }
  }

  function applyRebuttal(logId: string, text: string) {
    // Open the add panel pre-filled, but tie it to the same category by
    // copying the original log's text. The salesperson can then edit
    // and save as a new attempt OR paste into a reply.
    const log = logs.find((l) => l.id === logId);
    if (!log) return;
    setCategory(log.category);
    setText(log.text);
    setRebuttalUsed(text);
    setTemplateId("");
    setAdding(true);
    toast.success("Rebuttal copied into the form");
  }

  async function remove(id: string) {
    if (!confirm("Delete this logged objection?")) return;
    const res = await fetch(`/api/leads/${leadId}/objections/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error ?? "Delete failed");
      return;
    }
    setLogs((cur) => cur.filter((l) => l.id !== id));
    toast.success("Deleted");
  }

  const filteredReference = useMemo(
    () => (referenceFilter ? reference.filter((t) => t.category === referenceFilter) : reference),
    [reference, referenceFilter],
  );

  if (loading) return <p className="text-sm text-gtn-grey-2">Loading…</p>;

  return (
    <div className="space-y-6">
      {/* Logged objections */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gtn-navy">Objections raised on this lead</h2>
          {canEdit && (
            <Button size="sm" onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "+ Log objection"}</Button>
          )}
        </div>

        {adding && (
          <Card className="mb-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Category *</Label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                >
                  {OBJECTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1 mt-3">
              <Label className="text-xs">Objection text *</Label>
              <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="What did they actually say?" />
            </div>
            <div className="space-y-1 mt-3">
              <Label className="text-xs">Rebuttal used (optional)</Label>
              <Textarea rows={4} value={rebuttalUsed} onChange={(e) => setRebuttalUsed(e.target.value)} />
              {templateId && <p className="text-[10px] text-gtn-grey-2 mt-1">Pre-filled from library template — feel free to edit.</p>}
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Log"}</Button>
            </div>
          </Card>
        )}

        {logs.length === 0 ? (
          <p className="text-sm text-gtn-grey-2">No objections logged yet.</p>
        ) : (
          <ul className="divide-y divide-gtn-lavender-2 border border-gtn-lavender-2 rounded-md">
            {logs.map((l) => (
              <li key={l.id} className="px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wide font-semibold rounded-full bg-gtn-lavender text-gtn-navy px-2 py-0.5">
                        {l.category}
                      </span>
                      {l.template && (
                        <span className="text-[10px] uppercase tracking-wide rounded-full bg-gtn-lavender-2 text-gtn-purple px-2 py-0.5">
                          library
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-gtn-navy mt-1">{`"${l.text}"`}</p>
                    {l.rebuttalUsed && (
                      <p className="text-xs text-gtn-grey-2 mt-1 whitespace-pre-wrap"><strong>Rebuttal:</strong> {l.rebuttalUsed}</p>
                    )}
                    <p className="text-[10px] text-gtn-grey-3 mt-1">
                      {l.raisedBy.name} · {format(new Date(l.raisedAt), "PPp")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canEdit && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => coach(l.id)}
                          disabled={coachingId === l.id}
                          className="h-7 px-2 text-xs"
                        >
                          {coachingId === l.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5 mr-1" />
                          )}
                          {coachingId === l.id ? "Coaching…" : "Coach me"}
                        </Button>
                        <select
                          value={l.outcome ?? ""}
                          onChange={(e) => updateOutcome(l.id, e.target.value)}
                          className="h-7 rounded border border-input bg-white px-2 text-xs"
                        >
                          {OUTCOME_OPTIONS.map((o) => (
                            <option key={o} value={o}>{o || "— outcome —"}</option>
                          ))}
                        </select>
                        <button onClick={() => remove(l.id)} className="text-xs text-gtn-red hover:underline">delete</button>
                      </>
                    )}
                  </div>
                </div>
                {(() => {
                  const c = coachResults[l.id];
                  if (!c) return null;
                  return (
                    <div className="mt-3 rounded-md border border-gtn-lavender-2 bg-gtn-lavender/30 p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-gtn-purple" />
                        <span className="text-[11px] uppercase tracking-wide font-semibold text-gtn-purple">
                          Gateway AI rebuttals ({c.rebuttals.length})
                        </span>
                      </div>
                      <ol className="space-y-2 list-decimal list-inside">
                        {c.rebuttals.map((r, i) => (
                          <li key={i} className="text-sm text-gtn-navy">
                            <span className="whitespace-pre-wrap">{r.rebuttal}</span>
                            <div className="ml-5 mt-1 flex items-center gap-2 flex-wrap">
                              {r.tone && (
                                <span className="text-[10px] uppercase tracking-wide rounded-full bg-white text-gtn-grey-2 px-2 py-0.5 border border-gtn-lavender-2">
                                  {r.tone}
                                </span>
                              )}
                              {r.why && (
                                <span className="text-[11px] italic text-gtn-grey-2">why: {r.why}</span>
                              )}
                              {canEdit && (
                                <button
                                  onClick={() => applyRebuttal(l.id, r.rebuttal)}
                                  className="text-[11px] text-gtn-purple hover:underline"
                                >
                                  Use this one
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                      {c.ifEscalated && (
                        <p className="text-xs text-gtn-grey-2 border-t border-gtn-lavender-2 pt-2">
                          <strong>If they push back:</strong> {c.ifEscalated}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Reference panel */}
      <section>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-gtn-navy">Objections library</h2>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Filter:</Label>
            <select
              value={referenceFilter}
              onChange={(e) => setReferenceFilter(e.target.value)}
              className="h-7 rounded border border-input bg-white px-2 text-xs"
            >
              <option value="">All categories</option>
              {OBJECTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {filteredReference.length === 0 ? (
          <p className="text-sm text-gtn-grey-2">No reference entries for this filter.</p>
        ) : (
          <ul className="divide-y divide-gtn-lavender-2 border border-gtn-lavender-2 rounded-md">
            {filteredReference.map((t) => (
              <li key={t.id} className="px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wide font-semibold rounded-full bg-gtn-lavender text-gtn-navy px-2 py-0.5">
                        {t.category}
                      </span>
                      {t.industry && (
                        <span className="text-[10px] uppercase tracking-wide rounded-full bg-gtn-lavender-2 text-gtn-purple px-2 py-0.5">
                          {t.industry.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-gtn-navy mt-1">{`"${t.trigger}"`}</p>
                    <p className="text-xs text-gtn-grey-2 mt-1 whitespace-pre-wrap">{t.rebuttal}</p>
                    {t.source && <p className="text-[10px] text-gtn-grey-3 mt-1">— {t.source}</p>}
                  </div>
                  {canEdit && (
                    <Button size="sm" variant="secondary" onClick={() => pickTemplate(t)}>
                      Log this
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// quiet unused-import linters when Input ends up not referenced directly
void Input;

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { OBJECTION_CATEGORIES } from "@/lib/objections/defaults";

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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Industry } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { OBJECTION_CATEGORIES } from "@/lib/objections/defaults";

type Template = {
  id: string;
  category: string;
  industry: Industry | null;
  trigger: string;
  rebuttal: string;
  source: string | null;
  active: boolean;
};

type Draft = {
  category: string;
  industry: Industry | "";
  trigger: string;
  rebuttal: string;
  source: string;
  active: boolean;
};

const EMPTY_DRAFT: Draft = {
  category: "PRICE",
  industry: "",
  trigger: "",
  rebuttal: "",
  source: "",
  active: true,
};

export function ObjectionsEditor({ initial }: { initial: Template[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Template[]>(initial);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>("");

  function startNew() { setDraft(EMPTY_DRAFT); setEditingId("new"); }
  function startEdit(t: Template) {
    setDraft({
      category: t.category,
      industry: (t.industry as Industry | null) ?? "",
      trigger: t.trigger,
      rebuttal: t.rebuttal,
      source: t.source ?? "",
      active: t.active,
    });
    setEditingId(t.id);
  }

  async function save() {
    if (!draft.trigger.trim() || !draft.rebuttal.trim()) {
      toast.error("Trigger and rebuttal are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        category: draft.category,
        industry: draft.industry === "" ? null : draft.industry,
        trigger: draft.trigger.trim(),
        rebuttal: draft.rebuttal,
        source: draft.source.trim() ? draft.source.trim() : null,
        active: draft.active,
      };
      const url = editingId === "new" ? "/api/admin/objections" : `/api/admin/objections/${editingId}`;
      const method = editingId === "new" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? "Save failed"); return; }
      toast.success(editingId === "new" ? "Objection added" : "Updated");
      if (editingId === "new") setItems((cur) => [data.template, ...cur]);
      else setItems((cur) => cur.map((t) => (t.id === data.template.id ? data.template : t)));
      setEditingId(null); setDraft(EMPTY_DRAFT);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this objection? Salespeople won't see it as a reference anymore.")) return;
    const res = await fetch(`/api/admin/objections/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error ?? "Delete failed");
      return;
    }
    setItems((cur) => cur.filter((t) => t.id !== id));
    toast.success("Deleted");
    router.refresh();
  }

  const filtered = filter ? items.filter((t) => t.category === filter) : items;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Label className="text-xs">Filter:</Label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 rounded border border-input bg-white px-2 text-xs"
          >
            <option value="">All categories</option>
            {OBJECTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-xs text-gtn-grey-2">{filtered.length} of {items.length}</span>
        </div>
        {editingId === null && <Button onClick={startNew}>+ New objection</Button>}
      </div>

      {editingId !== null && (
        <Card>
          <h2 className="text-sm font-semibold text-gtn-navy mb-3">
            {editingId === "new" ? "New objection" : "Edit objection"}
          </h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Category *</Label>
              <select
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
              >
                {OBJECTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Industry (optional)</Label>
              <select
                value={draft.industry}
                onChange={(e) => setDraft((d) => ({ ...d, industry: e.target.value as Industry | "" }))}
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
              >
                <option value="">— All industries —</option>
                {(Object.values(Industry) as Industry[]).map((i) => (
                  <option key={i} value={i}>{i.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Source citation (optional)</Label>
              <Input
                value={draft.source}
                onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
                placeholder="Playbook §… / case study / call note"
              />
            </div>
          </div>
          <div className="space-y-1 mt-3">
            <Label className="text-xs">Trigger * <span className="text-gtn-grey-2">{"— the line you'll hear"}</span></Label>
            <Input value={draft.trigger} onChange={(e) => setDraft((d) => ({ ...d, trigger: e.target.value }))} />
          </div>
          <div className="space-y-1 mt-3">
            <Label className="text-xs">Rebuttal *</Label>
            <Textarea rows={6} value={draft.rebuttal} onChange={(e) => setDraft((d) => ({ ...d, rebuttal: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-xs mt-3">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
            />
            <span>{"Active — surface in Lin's reference panel"}</span>
          </label>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => { setEditingId(null); setDraft(EMPTY_DRAFT); }} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editingId === "new" ? "Create" : "Save"}</Button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-gtn-grey-2 p-4">No objections in this view.</p>
        ) : (
          <ul className="divide-y divide-gtn-lavender-2">
            {filtered.map((t) => (
              <li key={t.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
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
                      {!t.active && (
                        <span className="text-[10px] uppercase tracking-wide font-semibold rounded-full bg-[#FBE9E7] text-gtn-red px-2 py-0.5">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-gtn-navy mt-1">{`"${t.trigger}"`}</p>
                    <p className="text-xs text-gtn-grey-2 mt-1 whitespace-pre-wrap">{t.rebuttal}</p>
                    {t.source && <p className="text-[10px] text-gtn-grey-3 mt-1">— {t.source}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => startEdit(t)}>Edit</Button>
                    <button onClick={() => remove(t.id)} className="text-xs text-gtn-red hover:underline">delete</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { Industry } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
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

/**
 * v3.1.4 — objections editor on v3 tokens + Badge.
 */
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
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Label className="text-xs">Filter:</Label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 rounded-md border border-line bg-surface px-2.5 text-xs text-ink-strong hover:border-line-strong focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-colors"
          >
            <option value="">All categories</option>
            {OBJECTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-xs text-ink-muted tabular">
            {filtered.length} of {items.length}
          </span>
        </div>
        {editingId === null && (
          <Button size="sm" onClick={startNew}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New objection
          </Button>
        )}
      </div>

      {/* Edit form */}
      {editingId !== null && (
        <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-strong">
              {editingId === "new" ? "New objection" : "Edit objection"}
            </h2>
            <button
              onClick={() => { setEditingId(null); setDraft(EMPTY_DRAFT); }}
              disabled={saving}
              className="text-ink-muted hover:text-ink-strong transition-colors p-1"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Category <span className="text-danger">*</span></Label>
              <select
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink-strong hover:border-line-strong focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-colors"
              >
                {OBJECTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Industry (optional)</Label>
              <select
                value={draft.industry}
                onChange={(e) => setDraft((d) => ({ ...d, industry: e.target.value as Industry | "" }))}
                className="flex h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink-strong hover:border-line-strong focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-colors"
              >
                <option value="">— All industries —</option>
                {(Object.values(Industry) as Industry[]).map((i) => (
                  <option key={i} value={i}>{i.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Source citation (optional)</Label>
              <Input
                value={draft.source}
                onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
                placeholder="Playbook §… / case study / call note"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              Trigger <span className="text-danger">*</span>{" "}
              <span className="text-ink-faint normal-case">— the line you&apos;ll hear</span>
            </Label>
            <Input
              value={draft.trigger}
              onChange={(e) => setDraft((d) => ({ ...d, trigger: e.target.value }))}
              placeholder="&ldquo;Your pricing is way out of line with what we&apos;re paying now.&rdquo;"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Rebuttal <span className="text-danger">*</span></Label>
            <Textarea
              rows={6}
              value={draft.rebuttal}
              onChange={(e) => setDraft((d) => ({ ...d, rebuttal: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-muted cursor-pointer">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
              className="accent-gtn-purple h-4 w-4"
            />
            <span>Active — surface in Lin&apos;s reference panel</span>
          </label>
          <div className="flex justify-end gap-2 pt-2 border-t border-line-subtle">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setEditingId(null); setDraft(EMPTY_DRAFT); }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={save} size="sm" disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {saving ? "Saving…" : editingId === "new" ? "Create" : "Save changes"}
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="rounded-xl bg-surface border border-line-subtle overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-ink-faint italic p-6 text-center">No objections in this view.</p>
        ) : (
          <ul className="divide-y divide-line-subtle">
            {filtered.map((t) => (
              <li key={t.id} className="px-4 py-3.5 hover:bg-surface-3/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      <Badge tone="brand" shape="pill" size="xs">{t.category}</Badge>
                      {t.industry && (
                        <Badge tone="accent" shape="pill" size="xs">{t.industry.replace(/_/g, " ")}</Badge>
                      )}
                      {!t.active && (
                        <Badge tone="danger" shape="pill" size="xs">Inactive</Badge>
                      )}
                    </div>
                    <p className="font-medium text-ink-strong">{`"${t.trigger}"`}</p>
                    <p className="text-xs text-ink-muted mt-1.5 whitespace-pre-wrap leading-relaxed">{t.rebuttal}</p>
                    {t.source && (
                      <p className="text-[10px] text-ink-faint mt-1.5 italic">— {t.source}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => startEdit(t)}>Edit</Button>
                    <button
                      onClick={() => remove(t.id)}
                      className="text-ink-faint hover:text-danger transition-colors p-1"
                      aria-label="Delete objection"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Industry, OutreachCategory } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { extractPlaceholders } from "@/lib/outreach/templates";

type Template = {
  id: string;
  name: string;
  category: OutreachCategory;
  industry: Industry | null;
  trigger: string | null;
  subject: string;
  body: string;
  placeholders: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type Draft = {
  name: string;
  category: OutreachCategory;
  industry: Industry | "";
  trigger: string;
  subject: string;
  body: string;
  active: boolean;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  category: OutreachCategory.INTRO,
  industry: "",
  trigger: "",
  subject: "",
  body: "",
  active: true,
};

const CATEGORY_LABEL: Record<OutreachCategory, string> = {
  INTRO: "Intro",
  FOLLOW_UP: "Follow-up",
  POST_ASSESSMENT: "Post-assessment",
  PROPOSAL: "Proposal",
  NURTURE: "Nurture",
};

export function OutreachEditor({ initial }: { initial: Template[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Template[]>(initial);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const placeholdersPreview = useMemo(
    () => extractPlaceholders(`${draft.subject}\n${draft.body}`),
    [draft.subject, draft.body],
  );

  function startNew() {
    setDraft(EMPTY_DRAFT);
    setEditingId("new");
  }

  function startEdit(t: Template) {
    setDraft({
      name: t.name,
      category: t.category,
      industry: (t.industry as Industry | null) ?? "",
      trigger: t.trigger ?? "",
      subject: t.subject,
      body: t.body,
      active: t.active,
    });
    setEditingId(t.id);
  }

  async function save() {
    if (!draft.name.trim() || !draft.subject.trim() || !draft.body.trim()) {
      toast.error("Name, subject, and body are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        category: draft.category,
        industry: draft.industry === "" ? null : draft.industry,
        trigger: draft.trigger.trim() ? draft.trigger.trim() : null,
        subject: draft.subject,
        body: draft.body,
        active: draft.active,
      };
      let res: Response;
      if (editingId === "new") {
        res = await fetch("/api/admin/outreach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/admin/outreach/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Save failed");
        return;
      }
      toast.success(editingId === "new" ? "Template created" : "Template updated");
      if (editingId === "new") {
        setItems((cur) => [data.template, ...cur]);
      } else {
        setItems((cur) => cur.map((t) => (t.id === data.template.id ? data.template : t)));
      }
      setEditingId(null);
      setDraft(EMPTY_DRAFT);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this template? It will no longer appear in Lin's outreach composer.")) return;
    const res = await fetch(`/api/admin/outreach/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error ?? "Delete failed");
      return;
    }
    setItems((cur) => cur.filter((t) => t.id !== id));
    toast.success("Deleted");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {editingId === null && <Button onClick={startNew}>+ New template</Button>}
      </div>

      {editingId !== null && (
        <Card>
          <h2 className="text-sm font-semibold text-gtn-navy mb-3">
            {editingId === "new" ? "New template" : "Edit template"}
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Name *</Label>
              <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category *</Label>
              <select
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as OutreachCategory }))}
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
              >
                {(Object.values(OutreachCategory) as OutreachCategory[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Industry filter (optional)</Label>
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
              <Label className="text-xs">Trigger label (optional)</Label>
              <Input
                value={draft.trigger}
                onChange={(e) => setDraft((d) => ({ ...d, trigger: e.target.value }))}
                placeholder="e.g. cold_outreach, post_meeting, stalled_deal"
              />
            </div>
          </div>
          <div className="space-y-1 mt-3">
            <Label className="text-xs">Subject *</Label>
            <Input value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} />
          </div>
          <div className="space-y-1 mt-3">
            <Label className="text-xs">Body * <span className="text-gtn-grey-2">— use {"{{placeholders}}"} for variable substitution</span></Label>
            <Textarea
              rows={12}
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              className="font-mono text-xs"
            />
          </div>
          {placeholdersPreview.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <p className="text-[10px] uppercase tracking-wide text-gtn-grey-2 mr-1 mt-1">Detected placeholders:</p>
              {placeholdersPreview.map((p) => (
                <span key={p} className="text-[11px] font-mono bg-gtn-lavender text-gtn-navy rounded px-2 py-0.5">{`{{${p}}}`}</span>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 text-xs mt-3">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
            />
            <span>{"Active — surface in Lin's composer"}</span>
          </label>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => { setEditingId(null); setDraft(EMPTY_DRAFT); }} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editingId === "new" ? "Create" : "Save"}</Button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {items.length === 0 ? (
          <p className="text-sm text-gtn-grey-2 p-4">
            No templates yet. The seed defaults will appear here after the next `prisma db seed` run.
          </p>
        ) : (
          <ul className="divide-y divide-gtn-lavender-2">
            {items.map((t) => (
              <li key={t.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gtn-navy">{t.name}</p>
                    <span className="text-[10px] uppercase tracking-wide font-semibold rounded-full bg-gtn-lavender text-gtn-navy px-2 py-0.5">
                      {CATEGORY_LABEL[t.category]}
                    </span>
                    {t.industry && (
                      <span className="text-[10px] uppercase tracking-wide rounded-full bg-gtn-lavender-2 text-gtn-purple px-2 py-0.5">
                        {t.industry.replace(/_/g, " ")}
                      </span>
                    )}
                    {t.trigger && (
                      <span className="text-[10px] font-mono text-gtn-grey-2">@{t.trigger}</span>
                    )}
                    {!t.active && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold rounded-full bg-[#FBE9E7] text-gtn-red px-2 py-0.5">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gtn-grey-2 mt-1 truncate">{t.subject}</p>
                  <p className="text-[10px] text-gtn-grey-3 mt-1">
                    {t.placeholders.length} placeholder{t.placeholders.length === 1 ? "" : "s"} ·
                    updated {format(new Date(t.updatedAt), "PPp")}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button size="sm" variant="secondary" onClick={() => startEdit(t)}>Edit</Button>
                  <button onClick={() => remove(t.id)} className="text-xs text-gtn-red hover:underline">delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

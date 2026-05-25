"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { Industry, OutreachCategory } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
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

/**
 * v3.1.4 — outreach editor on v3 tokens + Badge.
 */
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
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink-strong tabular">{items.length}</span> template
          {items.length === 1 ? "" : "s"}
          {items.length > 0 && (
            <> · {items.filter((t) => t.active).length} active</>
          )}
        </p>
        {editingId === null && (
          <Button size="sm" onClick={startNew}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New template
          </Button>
        )}
      </div>

      {/* Edit form */}
      {editingId !== null && (
        <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-strong">
              {editingId === "new" ? "New template" : "Edit template"}
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
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name <span className="text-danger">*</span></Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category <span className="text-danger">*</span></Label>
              <select
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as OutreachCategory }))}
                className="flex h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink-strong hover:border-line-strong focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-colors"
              >
                {(Object.values(OutreachCategory) as OutreachCategory[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Industry filter (optional)</Label>
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
              <Label className="text-xs">Trigger label (optional)</Label>
              <Input
                value={draft.trigger}
                onChange={(e) => setDraft((d) => ({ ...d, trigger: e.target.value }))}
                placeholder="e.g. cold_outreach, post_meeting, stalled_deal"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Subject <span className="text-danger">*</span></Label>
            <Input
              value={draft.subject}
              onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              Body <span className="text-danger">*</span>{" "}
              <span className="text-ink-faint normal-case">— use {"{{placeholders}}"} for variable substitution</span>
            </Label>
            <Textarea
              rows={12}
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              className="font-mono text-xs"
            />
          </div>
          {placeholdersPreview.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <p className="text-[10px] uppercase tracking-wide text-ink-muted font-semibold mr-1">
                Detected placeholders:
              </p>
              {placeholdersPreview.map((p) => (
                <span
                  key={p}
                  className="text-[11px] font-mono bg-brand-soft text-gtn-navy rounded px-2 py-0.5"
                >
                  {`{{${p}}}`}
                </span>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 text-xs text-ink-muted cursor-pointer">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
              className="accent-gtn-purple h-4 w-4"
            />
            <span>Active — surface in Lin&apos;s composer</span>
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
        {items.length === 0 ? (
          <p className="text-sm text-ink-faint italic p-6 text-center">
            No templates yet. The seed defaults will appear here after the next{" "}
            <code className="font-mono text-[10px] bg-surface-2 px-1.5 py-0.5 rounded text-ink-strong not-italic">prisma db seed</code> run.
          </p>
        ) : (
          <ul className="divide-y divide-line-subtle">
            {items.map((t) => (
              <li
                key={t.id}
                className="px-4 py-3.5 flex items-start justify-between gap-3 hover:bg-surface-3/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-ink-strong">{t.name}</p>
                    <Badge tone="brand" shape="pill" size="xs">{CATEGORY_LABEL[t.category]}</Badge>
                    {t.industry && (
                      <Badge tone="accent" shape="pill" size="xs">{t.industry.replace(/_/g, " ")}</Badge>
                    )}
                    {t.trigger && (
                      <span className="text-[10px] font-mono text-ink-muted">@{t.trigger}</span>
                    )}
                    {!t.active && (
                      <Badge tone="danger" shape="pill" size="xs">Inactive</Badge>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted mt-1 truncate">{t.subject}</p>
                  <p className="text-[10px] text-ink-faint mt-1 tabular">
                    {t.placeholders.length} placeholder{t.placeholders.length === 1 ? "" : "s"} ·{" "}
                    updated {format(new Date(t.updatedAt), "PPp")}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button size="sm" variant="secondary" onClick={() => startEdit(t)}>Edit</Button>
                  <button
                    onClick={() => remove(t.id)}
                    className="text-ink-faint hover:text-danger transition-colors p-1"
                    aria-label="Delete template"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

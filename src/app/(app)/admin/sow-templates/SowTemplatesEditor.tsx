"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Industry, ServiceBundle } from "@prisma/client";
import { ChevronDown, ChevronRight, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/help/EmptyState";
import { FileText } from "lucide-react";

type Tmpl = {
  id: string;
  name: string;
  description: string | null;
  bundle: ServiceBundle | null;
  industry: Industry | null;
  version: number;
  active: boolean;
  scopeMarkdown: string;
  deliverablesMarkdown: string;
  timelineMarkdown: string;
  exclusionsMarkdown: string;
  termsMarkdown: string;
  updatedAt: string;
};

const MERGE_FIELDS = [
  "{{customer.name}}",
  "{{customer.seats}}",
  "{{customer.industry}}",
  "{{customer.complianceDrivers}}",
  "{{deal.bundle}}",
  "{{deal.priceMrr}}",
  "{{deal.priceOneTime}}",
  "{{lead.statedPain}}",
  "{{lead.triggerEvent}}",
];

const SECTION_LABELS = {
  scopeMarkdown: "Scope",
  deliverablesMarkdown: "Deliverables",
  timelineMarkdown: "Timeline",
  exclusionsMarkdown: "Exclusions",
  termsMarkdown: "Terms",
} as const;
type SectionKey = keyof typeof SECTION_LABELS;

export function SowTemplatesEditor({ initial }: { initial: Tmpl[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Tmpl[]>(initial);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, Partial<Tmpl>>>({});
  const [busy, setBusy] = useState(false);

  // New template
  const [name, setName] = useState("");
  const [bundle, setBundle] = useState<ServiceBundle | "">("");
  const [industry, setIndustry] = useState<Industry | "">("");

  function toggleOpen(id: string) {
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createTemplate() {
    if (!name.trim()) return toast.error("Name required");
    setBusy(true);
    try {
      const res = await fetch("/api/sow-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          bundle: bundle || null,
          industry: industry || null,
          scopeMarkdown: "## Scope\n\nWe will deliver [scope] for {{customer.name}} ({{customer.seats}} seats).\n",
          deliverablesMarkdown: "## Deliverables\n\n- [deliverable 1]\n- [deliverable 2]\n",
          timelineMarkdown: "## Timeline\n\nKickoff: Week 0\nGo-live: Week [N]\n",
          exclusionsMarkdown: "## Exclusions\n\n- Hardware not specified above\n- Third-party SaaS licensing\n",
          termsMarkdown: "## Terms\n\n- Billing: monthly in advance\n- Cancellation: 60 days written notice\n",
        }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data?.error ?? "Failed");
      toast.success("Template created");
      setItems((cur) => [data.template, ...cur]);
      setName(""); setBundle(""); setIndustry("");
      setCreating(false);
      router.refresh();
    } finally { setBusy(false); }
  }

  async function saveTemplate(id: string) {
    const draft = drafts[id];
    if (!draft) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sow-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data?.error ?? "Save failed");
      toast.success("Saved");
      setItems((cur) => cur.map((t) => (t.id === id ? data.template : t)));
      setDrafts((d) => { const n = { ...d }; delete n[id]; return n; });
      router.refresh();
    } finally { setBusy(false); }
  }

  async function deleteTemplate(id: string, name: string) {
    if (!confirm(`Archive "${name}"? Existing proposals drafted from it are preserved.`)) return;
    const res = await fetch(`/api/sow-templates/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return toast.error(data?.error ?? "Failed");
    }
    setItems((cur) => cur.map((t) => (t.id === id ? { ...t, active: false } : t)));
    toast.success("Archived");
    router.refresh();
  }

  function patch(id: string, key: SectionKey | "name" | "description", value: string) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [key]: value } }));
  }

  const activeCount = useMemo(() => items.filter((t) => t.active).length, [items]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink-strong tabular">{items.length}</span> templates
          {items.length > 0 && <> · <span className="font-mono tabular">{activeCount}</span> active</>}
        </p>
        <Button size="sm" onClick={() => setCreating((c) => !c)}>
          {creating ? <X className="h-3.5 w-3.5 mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
          {creating ? "Cancel" : "New template"}
        </Button>
      </div>

      {creating && (
        <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Name <span className="text-danger">*</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Managed IT — Compliance Plus" />
            </div>
            <div className="space-y-1.5">
              <Label>Bundle (optional)</Label>
              <select value={bundle} onChange={(e) => setBundle(e.target.value as ServiceBundle | "")}
                className="flex h-9 w-full rounded-md border border-line bg-surface px-3 text-sm">
                <option value="">Any bundle</option>
                {(Object.values(ServiceBundle) as ServiceBundle[]).map((b) => (
                  <option key={b} value={b}>{b.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Industry (optional)</Label>
              <select value={industry} onChange={(e) => setIndustry(e.target.value as Industry | "")}
                className="flex h-9 w-full rounded-md border border-line bg-surface px-3 text-sm">
                <option value="">Any industry</option>
                {(Object.values(Industry) as Industry[]).map((i) => (
                  <option key={i} value={i}>{i.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-ink-faint">
            We&apos;ll seed the 5 sections with starter content. You can polish each before salespeople use them.
            Available merge fields: <span className="font-mono text-ink-muted">{MERGE_FIELDS.slice(0, 5).join(" ")}…</span>
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-line-subtle">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)} disabled={busy}>Cancel</Button>
            <Button size="sm" onClick={createTemplate} disabled={busy || !name.trim()}>
              {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Create template
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          Icon={FileText}
          title="No SOW templates yet"
          body="Add one template per bundle (Essential, Professional, Compliance Plus, Enterprise, Custom). Salespeople draft from these — the AI assistant fills in merge fields from each lead's specifics."
          cta={{ label: "New template", href: "#" }}
        />
      ) : (
        items.map((t) => {
          const draft = drafts[t.id] ?? {};
          const dirty = Object.keys(draft).length > 0;
          const isOpen = open.has(t.id);
          return (
            <div key={t.id} className={`rounded-xl bg-surface border border-line-subtle overflow-hidden ${!t.active ? "opacity-60" : ""}`}>
              <button type="button" onClick={() => toggleOpen(t.id)}
                className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-surface-3/40 transition-colors text-left">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-ink-muted flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-ink-muted flex-shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-strong truncate">{t.name}</p>
                    <p className="text-[11px] text-ink-faint">
                      v{t.version} · {t.bundle ? t.bundle.replace(/_/g, " ").toLowerCase() : "generalist"}
                      {t.industry ? ` · ${t.industry.replace(/_/g, " ").toLowerCase()}` : ""}
                    </p>
                  </div>
                </div>
                {!t.active && <Badge tone="danger" shape="pill" size="xs">archived</Badge>}
                {dirty && <Badge tone="warn" shape="pill" size="xs">unsaved</Badge>}
              </button>
              {isOpen && (
                <div className="border-t border-line-subtle px-4 py-4 space-y-3 bg-surface-2/30">
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input
                      value={draft.name ?? t.name}
                      onChange={(e) => patch(t.id, "name", e.target.value)}
                    />
                  </div>
                  {(["scopeMarkdown", "deliverablesMarkdown", "timelineMarkdown", "exclusionsMarkdown", "termsMarkdown"] as SectionKey[]).map((key) => (
                    <div key={key} className="space-y-1.5">
                      <Label>{SECTION_LABELS[key]}</Label>
                      <Textarea
                        rows={8}
                        value={draft[key] ?? t[key]}
                        onChange={(e) => patch(t.id, key, e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  ))}
                  <p className="text-[11px] text-ink-faint">
                    Merge fields: <span className="font-mono text-ink-muted break-all">{MERGE_FIELDS.join(" ")}</span>
                  </p>
                  <div className="flex justify-end gap-2 pt-2 border-t border-line-subtle">
                    <Button variant="ghost" size="sm" onClick={() => deleteTemplate(t.id, t.name)} disabled={busy}
                      className="text-danger hover:text-danger hover:bg-danger-soft">
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Archive
                    </Button>
                    <Button size="sm" onClick={() => saveTemplate(t.id)} disabled={busy || !dirty}>
                      {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                      {dirty ? "Save changes" : "Saved"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

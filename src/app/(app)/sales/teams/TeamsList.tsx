"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, X, Users } from "lucide-react";
import { ServiceLine } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/help/EmptyState";
import { cn } from "@/lib/utils";

type TeamRow = {
  id: string;
  name: string;
  description: string | null;
  serviceLines: ServiceLine[];
  active: boolean;
  memberCount: number;
  territoryCount: number;
  leadCount: number;
};

const ALL_SERVICE_LINES: ServiceLine[] = [
  ServiceLine.MANAGED_IT,
  ServiceLine.CYBERSECURITY,
  ServiceLine.NIST_ASSESSMENT,
  ServiceLine.AI_ADVISORY,
  ServiceLine.VCIO_RETAINER,
  ServiceLine.VOIP,
  ServiceLine.CABLING,
  ServiceLine.ACCESS_CONTROL,
  ServiceLine.VIDEO,
];

/**
 * v3.1.3 — Teams list, v3 tokens + Badge + branded EmptyState.
 */
export function TeamsList({ initialTeams }: { initialTeams: TeamRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([]);
  const [saving, setSaving] = useState(false);

  function toggleService(sl: ServiceLine) {
    setServiceLines((cur) => (cur.includes(sl) ? cur.filter((s) => s !== sl) : [...cur, sl]));
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/sales-teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          serviceLines,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Save failed");
        return;
      }
      toast.success("Team created");
      setName("");
      setDescription("");
      setServiceLines([]);
      setCreating(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink-strong tabular">{initialTeams.length}</span>{" "}
          team{initialTeams.length === 1 ? "" : "s"}
          {initialTeams.length > 0 && (
            <> · {initialTeams.filter((t) => t.active).length} active</>
          )}
        </p>
        <Button size="sm" onClick={() => setCreating((c) => !c)}>
          {creating ? <X className="h-3.5 w-3.5 mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
          {creating ? "Cancel" : "New team"}
        </Button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name <span className="text-danger">*</span></Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="IT Team" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this team focuses on."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Service lines this team sells</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {ALL_SERVICE_LINES.map((sl) => {
                const on = serviceLines.includes(sl);
                return (
                  <button
                    key={sl}
                    type="button"
                    onClick={() => toggleService(sl)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-colors duration-120 ease-smooth",
                      on
                        ? "bg-gtn-purple text-white border-gtn-purple"
                        : "bg-surface text-ink border-line hover:border-brand/40 hover:text-ink-strong",
                    )}
                  >
                    {sl.replace(/_/g, " ").toLowerCase()}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-ink-faint mt-1.5">Leave empty for a generalist team.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line-subtle">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !name.trim()} size="sm">
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {saving ? "Creating…" : "Create team"}
            </Button>
          </div>
        </div>
      )}

      {/* Empty state OR table */}
      {initialTeams.length === 0 ? (
        <EmptyState
          Icon={Users}
          title="No teams yet"
          body="Create your first sales team to start routing leads. Teams can be scoped to specific service lines (e.g. an 'IT Team' that takes Managed IT + Cybersecurity leads) or left general."
          cta={{ label: "New team", href: "#" }}
          secondaryCta={{ label: "Open Sales hub", href: "/sales" }}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line-subtle bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2">
              <tr>
                <th className="ui-label text-left px-4 py-2.5">Name</th>
                <th className="ui-label text-left px-4 py-2.5 hidden md:table-cell">Service lines</th>
                <th className="ui-label text-right px-4 py-2.5">Members</th>
                <th className="ui-label text-right px-4 py-2.5 hidden sm:table-cell">Territories</th>
                <th className="ui-label text-right px-4 py-2.5 hidden sm:table-cell">Leads</th>
                <th className="ui-label text-left px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {initialTeams.map((t) => (
                <tr
                  key={t.id}
                  className={cn(
                    "border-t border-line-subtle hover:bg-surface-3/40 transition-colors",
                    !t.active && "opacity-60",
                  )}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/sales/teams/${t.id}`}
                      className="text-ink-strong hover:text-gtn-purple font-medium block"
                    >
                      {t.name}
                    </Link>
                    {t.description && (
                      <p className="text-xs text-ink-muted mt-0.5 line-clamp-2">{t.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {t.serviceLines.length === 0 ? (
                      <span className="text-xs text-ink-faint italic">All services</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {t.serviceLines.map((s) => (
                          <span
                            key={s}
                            className="text-[10px] bg-brand-soft text-gtn-navy rounded px-1.5 py-0.5 capitalize"
                          >
                            {s.replace(/_/g, " ").toLowerCase()}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular text-ink-strong">{t.memberCount}</td>
                  <td className="px-4 py-3 text-right font-mono tabular text-ink-strong hidden sm:table-cell">{t.territoryCount}</td>
                  <td className="px-4 py-3 text-right font-mono tabular text-ink-strong hidden sm:table-cell">{t.leadCount}</td>
                  <td className="px-4 py-3">
                    <Badge tone={t.active ? "success" : "muted"} shape="pill" size="xs" dot>
                      {t.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

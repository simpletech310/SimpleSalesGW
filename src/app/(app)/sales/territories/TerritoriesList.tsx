"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Map, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/help/EmptyState";
import { cn } from "@/lib/utils";

type TerritoryRow = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  stateCount: number;
  zipCount: number;
  cityCount: number;
  hasPolygon: boolean;
  active: boolean;
};

type TeamOption = { id: string; name: string };

/**
 * v3.1.4 — Territories list redesigned. v3 tokens + Badge + branded EmptyState.
 */
export function TerritoriesList({
  initialTerritories,
  teams,
  defaultTeamId,
}: {
  initialTerritories: TerritoryRow[];
  teams: TeamOption[];
  defaultTeamId?: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState(defaultTeamId ?? teams[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [teamFilter, setTeamFilter] = useState<string>(defaultTeamId ?? "");

  const filtered = useMemo(
    () => (teamFilter ? initialTerritories.filter((t) => t.teamId === teamFilter) : initialTerritories),
    [initialTerritories, teamFilter],
  );

  async function save() {
    if (!name.trim() || !teamId) {
      toast.error("Name + team are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/sales-territories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), teamId, states: [], zipCodes: [], cities: [] }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Save failed");
        return;
      }
      toast.success("Territory created — open it to set boundaries");
      setName("");
      setCreating(false);
      router.push(`/sales/territories/${data.territory.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-ink-muted">
            <span className="font-semibold text-ink-strong tabular">{filtered.length}</span>{" "}
            territor{filtered.length === 1 ? "y" : "ies"}
            {filtered.length > 0 && (
              <> · {filtered.filter((t) => t.active).length} active</>
            )}
          </p>
          {teams.length > 1 && (
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="h-8 rounded-md border border-line bg-surface px-2.5 text-xs text-ink-strong hover:border-line-strong focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-colors"
              aria-label="Filter by team"
            >
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>
        <Button size="sm" onClick={() => setCreating((c) => !c)}>
          {creating ? <X className="h-3.5 w-3.5 mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
          {creating ? "Cancel" : "New territory"}
        </Button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name <span className="text-danger">*</span></Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="SoCal Coverage"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="team">Team <span className="text-danger">*</span></Label>
              <select
                id="team"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink-strong hover:border-line-strong focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-colors"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-ink-faint">
            We&apos;ll create the territory empty and drop you into the editor to set states, zip codes, cities, or draw a polygon on the map.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-line-subtle">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !name.trim() || !teamId} size="sm">
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {saving ? "Creating…" : "Create + edit"}
            </Button>
          </div>
        </div>
      )}

      {/* Empty state OR table */}
      {filtered.length === 0 ? (
        <EmptyState
          Icon={Map}
          title={teamFilter ? "No territories for this team" : "No territories yet"}
          body="Territories define where leads route. Each one is a hybrid of states, zip codes, cities, AND/OR a drawn polygon — any match assigns the lead to the team."
          cta={{ label: "New territory", href: "#" }}
          secondaryCta={{ label: "Manage teams", href: "/sales/teams" }}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line-subtle bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2">
              <tr>
                <th className="ui-label text-left px-4 py-2.5">Name</th>
                <th className="ui-label text-left px-4 py-2.5 hidden md:table-cell">Team</th>
                <th className="ui-label text-left px-4 py-2.5">Coverage</th>
                <th className="ui-label text-left px-4 py-2.5 hidden sm:table-cell">Polygon</th>
                <th className="ui-label text-left px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  className={cn(
                    "border-t border-line-subtle hover:bg-surface-3/40 transition-colors",
                    !t.active && "opacity-60",
                  )}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/sales/territories/${t.id}`}
                      className="text-ink-strong hover:text-gtn-purple font-medium"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-ink-muted">{t.teamName}</td>
                  <td className="px-4 py-3 text-xs text-ink-muted">
                    {t.stateCount === 0 && t.zipCount === 0 && t.cityCount === 0 ? (
                      <span className="italic text-ink-faint">none — polygon only</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {t.stateCount > 0 && (
                          <span className="text-[10px] bg-brand-soft text-gtn-navy rounded px-1.5 py-0.5 tabular">
                            {t.stateCount} state{t.stateCount === 1 ? "" : "s"}
                          </span>
                        )}
                        {t.zipCount > 0 && (
                          <span className="text-[10px] bg-brand-soft text-gtn-navy rounded px-1.5 py-0.5 tabular">
                            {t.zipCount} zip{t.zipCount === 1 ? "" : "s"}
                          </span>
                        )}
                        {t.cityCount > 0 && (
                          <span className="text-[10px] bg-brand-soft text-gtn-navy rounded px-1.5 py-0.5 tabular">
                            {t.cityCount} cit{t.cityCount === 1 ? "y" : "ies"}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {t.hasPolygon ? (
                      <Badge tone="brand" shape="pill" size="xs">drawn</Badge>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
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

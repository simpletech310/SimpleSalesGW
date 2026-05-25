"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge, ScoreBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/help/EmptyState";
import { cn } from "@/lib/utils";

type LeadRow = {
  id: string;
  businessName: string;
  industry: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  stage: string;
  dq: number;
  teamId: string | null;
  teamName: string | null;
  ownerName: string;
};

type Option = { id: string; name: string; email?: string };

/**
 * v3.1.2 — Assignment workbench.
 *
 * Was: gtn-* legacy tokens, basic table, Card with sticky header.
 * Now: v3 tokens (line-subtle, surface, brand), Badge stage chip,
 * ScoreBadge for DQ, branded EmptyState, calmer sticky toolbar.
 */
export function AssignWorkbench({
  initialLeads,
  teams,
  reps,
}: {
  initialLeads: LeadRow[];
  teams: Option[];
  reps: Option[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<
    { kind: "team"; teamId: string } | { kind: "rep"; ownerUserId: string } | null
  >(null);
  const [assigning, setAssigning] = useState(false);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(initialLeads.map((l) => l.id)));
  }
  function clear() {
    setSelected(new Set());
  }

  async function assign() {
    if (selected.size === 0 || !target) return;
    setAssigning(true);
    let okCount = 0;
    let failCount = 0;
    try {
      for (const leadId of selected) {
        const body =
          target.kind === "team"
            ? { teamId: target.teamId }
            : { ownerUserId: target.ownerUserId };
        const res = await fetch(`/api/leads/${leadId}/assign`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) okCount += 1;
        else failCount += 1;
      }
      if (failCount === 0) toast.success(`Assigned ${okCount} lead${okCount === 1 ? "" : "s"}.`);
      else toast.warning(`Assigned ${okCount}, ${failCount} failed.`);
      clear();
      router.refresh();
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Sticky toolbar */}
      <div className="sticky top-[52px] z-10 rounded-xl bg-surface border border-line-subtle px-4 py-3 shadow-card">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-ink-muted">
            <strong className="text-ink-strong tabular">{selected.size}</strong> selected{" "}
            <span className="text-ink-faint">·</span>{" "}
            <span className="tabular">{initialLeads.length}</span> shown
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="ghost" onClick={selectAll} disabled={initialLeads.length === 0}>
              Select all
            </Button>
            <Button size="sm" variant="ghost" onClick={clear} disabled={selected.size === 0}>
              Clear
            </Button>
            <select
              value={
                target ? (target.kind === "team" ? `team:${target.teamId}` : `rep:${target.ownerUserId}`) : ""
              }
              onChange={(e) => {
                const v = e.target.value;
                if (!v) {
                  setTarget(null);
                  return;
                }
                const [kind, idStr] = v.split(":");
                if (kind === "team") setTarget({ kind: "team", teamId: idStr! });
                else if (kind === "rep") setTarget({ kind: "rep", ownerUserId: idStr! });
              }}
              className={cn(
                "h-9 rounded-md border border-line bg-surface px-2.5 text-sm text-ink-strong min-w-[200px]",
                "hover:border-line-strong",
                "focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15",
                "transition-colors duration-120 ease-smooth",
              )}
            >
              <option value="">— pick target —</option>
              <optgroup label="Teams">
                {teams.map((t) => (
                  <option key={t.id} value={`team:${t.id}`}>
                    Team: {t.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Reps">
                {reps.map((r) => (
                  <option key={r.id} value={`rep:${r.id}`}>
                    Rep: {r.name}
                  </option>
                ))}
              </optgroup>
            </select>
            <Button onClick={assign} disabled={assigning || selected.size === 0 || !target} size="sm">
              {assigning ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
              Assign {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </div>
        </div>
      </div>

      {initialLeads.length === 0 ? (
        <EmptyState
          Icon={Inbox}
          title="All assigned"
          body="Every lead in this view has a team. New leads land here when their address doesn't auto-match a territory, or you can click 'show all' above to reassign."
          cta={{ label: "Open Sales hub", href: "/sales" }}
          secondaryCta={{ label: "Manage territories", href: "/sales/territories" }}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line-subtle bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2">
              <tr>
                <th className="w-10 px-3 py-2.5"></th>
                <th className="ui-label text-left px-3 py-2.5">Business</th>
                <th className="ui-label text-left px-3 py-2.5 hidden md:table-cell">Address</th>
                <th className="ui-label text-left px-3 py-2.5">Stage / DQ</th>
                <th className="ui-label text-left px-3 py-2.5 hidden md:table-cell">Current assignment</th>
              </tr>
            </thead>
            <tbody>
              {initialLeads.map((l) => {
                const isSelected = selected.has(l.id);
                return (
                  <tr
                    key={l.id}
                    className={cn(
                      "border-t border-line-subtle transition-colors",
                      isSelected ? "bg-brand-soft/40" : "hover:bg-surface-3/50",
                    )}
                  >
                    <td className="px-3 py-2.5 align-middle">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(l.id)}
                        className="w-4 h-4 rounded border-line text-brand focus:ring-2 focus:ring-brand/30 cursor-pointer"
                        aria-label={`Select ${l.businessName}`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/leads/${l.id}`}
                        className="text-ink-strong hover:text-gtn-purple font-medium block truncate"
                      >
                        {l.businessName}
                      </Link>
                      <p className="text-[11px] text-ink-muted capitalize">
                        {l.industry.replace(/_/g, " ").toLowerCase()}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-ink-muted hidden md:table-cell">
                      {[l.city, l.state, l.zip].filter(Boolean).join(" · ") || (
                        <span className="text-ink-faint italic">no address</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge tone="brand" shape="pill" size="xs">
                          {l.stage.replace(/_/g, " ").toLowerCase()}
                        </Badge>
                        <ScoreBadge score={l.dq} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs hidden md:table-cell">
                      <p className="text-ink-strong">
                        {l.teamName ?? <span className="text-ink-faint italic">no team</span>}
                      </p>
                      <p className="text-ink-muted">{l.ownerName}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

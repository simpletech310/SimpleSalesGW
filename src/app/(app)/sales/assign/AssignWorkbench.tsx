"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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
  const [target, setTarget] = useState<{ kind: "team"; teamId: string } | { kind: "rep"; ownerUserId: string } | null>(null);
  const [assigning, setAssigning] = useState(false);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
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
        const body = target.kind === "team"
          ? { teamId: target.teamId }
          : { ownerUserId: target.ownerUserId };
        const res = await fetch(`/api/leads/${leadId}/assign`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) okCount += 1; else failCount += 1;
      }
      if (failCount === 0) toast.success(`Assigned ${okCount} lead${okCount === 1 ? "" : "s"}.`);
      else toast.warning(`Assigned ${okCount}, ${failCount} failed.`);
      clear();
      router.refresh();
    } finally { setAssigning(false); }
  }

  return (
    <div className="space-y-3">
      <Card className="sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm text-gtn-grey-2">
            <strong className="text-gtn-navy">{selected.size}</strong> selected · {initialLeads.length} shown
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="ghost" onClick={selectAll} disabled={initialLeads.length === 0}>Select all</Button>
            <Button size="sm" variant="ghost" onClick={clear} disabled={selected.size === 0}>Clear</Button>
            <select
              value={target ? (target.kind === "team" ? `team:${target.teamId}` : `rep:${target.ownerUserId}`) : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) { setTarget(null); return; }
                const [kind, idStr] = v.split(":");
                if (kind === "team") setTarget({ kind: "team", teamId: idStr! });
                else if (kind === "rep") setTarget({ kind: "rep", ownerUserId: idStr! });
              }}
              className="h-9 rounded-md border border-input bg-white px-2 text-sm"
            >
              <option value="">— pick target —</option>
              <optgroup label="Teams">
                {teams.map((t) => <option key={t.id} value={`team:${t.id}`}>Team: {t.name}</option>)}
              </optgroup>
              <optgroup label="Reps">
                {reps.map((r) => <option key={r.id} value={`rep:${r.id}`}>Rep: {r.name}</option>)}
              </optgroup>
            </select>
            <Button onClick={assign} disabled={assigning || selected.size === 0 || !target}>
              {assigning ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
              Assign {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </div>
        </div>
      </Card>

      {initialLeads.length === 0 ? (
        <Card><p className="text-sm text-gtn-grey-2 italic">No leads matching the filter.</p></Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gtn-lavender text-left text-xs uppercase tracking-wide text-gtn-grey-2">
              <tr>
                <th className="px-3 py-3 w-8"></th>
                <th className="px-3 py-3">Business</th>
                <th className="px-3 py-3">Address</th>
                <th className="px-3 py-3">Stage / DQ</th>
                <th className="px-3 py-3">Current</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gtn-lavender-2">
              {initialLeads.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} />
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/leads/${l.id}`} className="text-gtn-purple hover:underline font-medium">{l.businessName}</Link>
                    <p className="text-[11px] text-gtn-grey-2">{l.industry.replace(/_/g, " ")}</p>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {[l.city, l.state, l.zip].filter(Boolean).join(" · ") || <span className="text-gtn-grey-3">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="gtn-stage-chip">{l.stage}</span>
                    <span className="ml-2 text-gtn-grey-2">DQ {l.dq}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <p>{l.teamName ?? <span className="text-gtn-grey-3 italic">no team</span>}</p>
                    <p className="text-gtn-grey-2">{l.ownerName}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

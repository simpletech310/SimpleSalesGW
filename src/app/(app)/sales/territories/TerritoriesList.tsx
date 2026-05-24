"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

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

  async function save() {
    if (!name.trim() || !teamId) { toast.error("Name + team are required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/sales-territories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), teamId, states: [], zipCodes: [], cities: [] }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? "Save failed"); return; }
      toast.success("Territory created — open it to set boundaries");
      setName(""); setCreating(false);
      router.push(`/sales/territories/${data.territory.id}`);
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating((c) => !c)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          {creating ? "Cancel" : "New territory"}
        </Button>
      </div>

      {creating && (
        <Card>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="SoCal Coverage" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="team">Team *</Label>
              <select id="team" value={teamId} onChange={(e) => setTeamId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving || !name.trim() || !teamId}>{saving ? "Creating…" : "Create + edit"}</Button>
          </div>
        </Card>
      )}

      {initialTerritories.length === 0 ? (
        <Card><p className="text-sm text-gtn-grey-2 italic">No territories yet.</p></Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gtn-lavender text-left text-xs uppercase tracking-wide text-gtn-grey-2">
              <tr>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Team</th>
                <th className="px-3 py-3">Coverage</th>
                <th className="px-3 py-3">Polygon</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gtn-lavender-2">
              {initialTerritories.map((t) => (
                <tr key={t.id} className={t.active ? "" : "opacity-50"}>
                  <td className="px-3 py-2">
                    <Link href={`/sales/territories/${t.id}`} className="text-gtn-purple hover:underline font-medium">{t.name}</Link>
                  </td>
                  <td className="px-3 py-2">{t.teamName}</td>
                  <td className="px-3 py-2 text-xs">
                    {t.stateCount > 0 && <span>{t.stateCount} state{t.stateCount === 1 ? "" : "s"}</span>}
                    {t.stateCount > 0 && (t.zipCount > 0 || t.cityCount > 0) && " · "}
                    {t.zipCount > 0 && <span>{t.zipCount} zip{t.zipCount === 1 ? "" : "s"}</span>}
                    {t.zipCount > 0 && t.cityCount > 0 && " · "}
                    {t.cityCount > 0 && <span>{t.cityCount} cit{t.cityCount === 1 ? "y" : "ies"}</span>}
                    {t.stateCount === 0 && t.zipCount === 0 && t.cityCount === 0 && (
                      <span className="text-gtn-grey-3 italic">none</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {t.hasPolygon ? (
                      <span className="text-[10px] uppercase font-semibold tracking-wide rounded-full px-2 py-0.5 bg-gtn-lavender text-gtn-purple">yes</span>
                    ) : (
                      <span className="text-gtn-grey-3">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {t.active ? (
                      <span className="text-[10px] uppercase font-semibold tracking-wide rounded-full px-2 py-0.5 bg-gtn-green-bg text-gtn-green">active</span>
                    ) : (
                      <span className="text-[10px] uppercase font-semibold tracking-wide rounded-full px-2 py-0.5 bg-gtn-lavender text-gtn-grey-2">inactive</span>
                    )}
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

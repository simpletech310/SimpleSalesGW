"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2, Star } from "lucide-react";
import { ServiceLine, TeamRole } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";

type MemberRow = {
  id: string;
  userId: string;
  isPrimary: boolean;
  role: TeamRole;
  user: { id: string; name: string; email: string; role: string; active: boolean };
};

type TerritoryRow = {
  id: string;
  name: string;
  states: string[];
  zipCount: number;
  cityCount: number;
  active: boolean;
};

type RepOption = { id: string; name: string; email: string };

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

export function TeamEditor({
  team,
  members,
  territories,
  leadCount,
  availableReps,
}: {
  team: { id: string; name: string; description: string | null; serviceLines: ServiceLine[]; active: boolean };
  members: MemberRow[];
  territories: TerritoryRow[];
  leadCount: number;
  availableReps: RepOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? "");
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>(team.serviceLines);
  const [active, setActive] = useState(team.active);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [newMemberId, setNewMemberId] = useState<string>("");
  const [newMemberPrimary, setNewMemberPrimary] = useState(false);

  function markDirty() { setDirty(true); }
  function toggleService(sl: ServiceLine) {
    setServiceLines((cur) => (cur.includes(sl) ? cur.filter((s) => s !== sl) : [...cur, sl]));
    markDirty();
  }

  async function saveTeam() {
    setSaving(true);
    try {
      const res = await fetch(`/api/sales-teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null, serviceLines, active }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? "Save failed"); return; }
      toast.success("Team saved");
      setDirty(false);
      router.refresh();
    } finally { setSaving(false); }
  }

  async function deleteTeam() {
    if (!confirm(`Soft-delete team "${team.name}"? Leads stay around but become unassigned.`)) return;
    const res = await fetch(`/api/sales-teams/${team.id}`, { method: "DELETE" });
    if (!res.ok) { const data = await res.json().catch(() => ({})); toast.error(data?.error ?? "Delete failed"); return; }
    toast.success("Team archived");
    router.push("/sales/teams");
    router.refresh();
  }

  async function addMember() {
    if (!newMemberId) return;
    const res = await fetch(`/api/sales-teams/${team.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: newMemberId, isPrimary: newMemberPrimary, role: TeamRole.MEMBER }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data?.error ?? "Add failed"); return; }
    toast.success("Member added");
    setNewMemberId(""); setNewMemberPrimary(false); setAddingMember(false);
    router.refresh();
  }

  async function removeMember(userId: string, userName: string) {
    if (!confirm(`Remove ${userName} from ${team.name}?`)) return;
    const res = await fetch(`/api/sales-teams/${team.id}/members/${userId}`, { method: "DELETE" });
    if (!res.ok) { const data = await res.json().catch(() => ({})); toast.error(data?.error ?? "Remove failed"); return; }
    toast.success("Removed");
    router.refresh();
  }

  // Filter out already-member reps from the add picker
  const memberUserIds = new Set(members.map((m) => m.userId));
  const addableReps = availableReps.filter((r) => !memberUserIds.has(r.id));

  return (
    <div className="space-y-4">
      {/* Sticky toolbar */}
      <Card className="sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-gtn-navy">Team settings</h2>
            <p className="text-xs text-gtn-grey-2">
              {members.length} member{members.length === 1 ? "" : "s"} · {territories.length} territor{territories.length === 1 ? "y" : "ies"} · {leadCount} lead{leadCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={deleteTeam}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Archive team
            </Button>
            <Button onClick={saveTeam} disabled={saving || !dirty}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" value={name} onChange={(e) => { setName(e.target.value); markDirty(); }} />
          </div>
          <div className="space-y-1 flex flex-col">
            <Label>Status</Label>
            <label className="inline-flex items-center gap-2 text-sm mt-2">
              <input type="checkbox" checked={active} onChange={(e) => { setActive(e.target.checked); markDirty(); }} />
              Active
            </label>
          </div>
        </div>
        <div className="space-y-1 mt-3">
          <Label htmlFor="desc">Description</Label>
          <Textarea id="desc" rows={2} value={description} onChange={(e) => { setDescription(e.target.value); markDirty(); }} />
        </div>
        <div className="space-y-1 mt-3">
          <Label>Service lines</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {ALL_SERVICE_LINES.map((sl) => {
              const on = serviceLines.includes(sl);
              return (
                <button
                  key={sl}
                  type="button"
                  onClick={() => toggleService(sl)}
                  className={`text-xs px-2 py-1 rounded-full border ${on ? "bg-gtn-purple text-white border-gtn-purple" : "bg-white text-gtn-grey-2 border-gtn-lavender-2 hover:border-gtn-purple/50"}`}
                >
                  {sl.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-gtn-navy">Members</h3>
            <p className="text-xs text-gtn-grey-2">
              Reps can belong to multiple teams. <strong>Primary</strong> is the default landing-team for their list view.
            </p>
          </div>
          <Button size="sm" onClick={() => setAddingMember((a) => !a)} disabled={addableReps.length === 0}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            {addingMember ? "Cancel" : "Add member"}
          </Button>
        </div>

        {addingMember && (
          <div className="border border-gtn-lavender-2 rounded-md p-3 mb-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <select value={newMemberId} onChange={(e) => setNewMemberId(e.target.value)} className="h-9 flex-1 rounded-md border border-input bg-white px-2 text-sm">
                <option value="">— pick a rep —</option>
                {addableReps.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.email}</option>)}
              </select>
              <label className="inline-flex items-center gap-1 text-xs">
                <input type="checkbox" checked={newMemberPrimary} onChange={(e) => setNewMemberPrimary(e.target.checked)} />
                Make this their primary team
              </label>
              <Button size="sm" onClick={addMember} disabled={!newMemberId}>Add</Button>
            </div>
            {addableReps.length === 0 && (
              <p className="text-xs text-gtn-grey-2 italic">No more reps to add. <Link href="/sales/reps" className="text-gtn-purple underline">Hire a new rep →</Link></p>
            )}
          </div>
        )}

        {members.length === 0 ? (
          <p className="text-xs text-gtn-grey-2 italic">No members yet — add reps above so they see this team&apos;s leads.</p>
        ) : (
          <ul className="divide-y divide-gtn-lavender-2">
            {members.map((m) => (
              <li key={m.id} className="py-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gtn-navy flex items-center gap-1">
                    {m.isPrimary && <Star className="h-3.5 w-3.5 text-gtn-amber" aria-label="Primary team" />}
                    {m.user.name}
                    <span className="text-xs text-gtn-grey-2">· {m.user.email}</span>
                  </p>
                  <p className="text-[11px] text-gtn-grey-3">{m.role.toLowerCase()} · {m.user.role}</p>
                </div>
                <button onClick={() => removeMember(m.userId, m.user.name)} className="text-xs text-gtn-red hover:underline">
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-gtn-navy">Territories</h3>
            <p className="text-xs text-gtn-grey-2">Geographic regions this team covers.</p>
          </div>
          <Button asChild size="sm" variant="secondary">
            <Link href={`/sales/territories?teamId=${team.id}`}>Manage territories</Link>
          </Button>
        </div>
        {territories.length === 0 ? (
          <p className="text-xs text-gtn-grey-2 italic">No territories yet.</p>
        ) : (
          <ul className="divide-y divide-gtn-lavender-2">
            {territories.map((t) => (
              <li key={t.id} className="py-2 flex items-center justify-between gap-2">
                <div>
                  <Link href={`/sales/territories/${t.id}`} className="text-sm font-medium text-gtn-purple hover:underline">{t.name}</Link>
                  <p className="text-[11px] text-gtn-grey-2 mt-0.5">
                    {t.states.length > 0 && `${t.states.length} state${t.states.length === 1 ? "" : "s"}`}
                    {t.zipCount > 0 && ` · ${t.zipCount} zip${t.zipCount === 1 ? "" : "s"}`}
                    {t.cityCount > 0 && ` · ${t.cityCount} cit${t.cityCount === 1 ? "y" : "ies"}`}
                    {t.states.length === 0 && t.zipCount === 0 && t.cityCount === 0 && "polygon only"}
                  </p>
                </div>
                {!t.active && <span className="text-[10px] uppercase font-semibold tracking-wide rounded-full px-2 py-0.5 bg-gtn-lavender text-gtn-grey-2">inactive</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

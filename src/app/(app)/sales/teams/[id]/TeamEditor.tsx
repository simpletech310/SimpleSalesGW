"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Save, Star, Trash2, UserPlus, X } from "lucide-react";
import { ServiceLine, TeamRole } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

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

/**
 * v3.2.0 — TeamEditor on v3 tokens. Members table now has a primary
 * toggle inline so the Sales Manager can promote/demote without a
 * round-trip to the API surface.
 */
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

  async function togglePrimary(userId: string, isPrimaryNow: boolean) {
    const res = await fetch(`/api/sales-teams/${team.id}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrimary: !isPrimaryNow }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error ?? "Update failed");
      return;
    }
    toast.success(isPrimaryNow ? "Primary cleared" : "Set as primary team");
    router.refresh();
  }

  const memberUserIds = new Set(members.map((m) => m.userId));
  const addableReps = availableReps.filter((r) => !memberUserIds.has(r.id));

  return (
    <div className="space-y-4">
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-10 rounded-xl bg-surface border border-line-subtle p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink-strong">Team settings</h2>
            <p className="text-xs text-ink-muted">
              <span className="font-mono tabular">{members.length}</span> member{members.length === 1 ? "" : "s"}
              {" · "}
              <span className="font-mono tabular">{territories.length}</span> territor{territories.length === 1 ? "y" : "ies"}
              {" · "}
              <span className="font-mono tabular">{leadCount}</span> lead{leadCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={deleteTeam} className="text-danger hover:text-danger hover:bg-danger-soft">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Archive team
            </Button>
            <Button onClick={saveTeam} disabled={saving || !dirty} size="sm">
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </Button>
          </div>
        </div>
      </div>

      {/* Identity + service lines */}
      <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="team-name">Name <span className="text-danger">*</span></Label>
            <Input id="team-name" value={name} onChange={(e) => { setName(e.target.value); markDirty(); }} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <label className="inline-flex items-center gap-2 text-sm text-ink-strong h-9 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => { setActive(e.target.checked); markDirty(); }}
                className="accent-gtn-purple h-4 w-4"
              />
              Active — routes leads to this team
            </label>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="team-desc">Description</Label>
          <Textarea
            id="team-desc"
            rows={2}
            value={description}
            onChange={(e) => { setDescription(e.target.value); markDirty(); }}
            placeholder="What this team focuses on."
          />
        </div>
        <div className="space-y-1.5">
          <Label>Service lines this team sells</Label>
          <div className="flex flex-wrap gap-1.5">
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
          <p className="text-[11px] text-ink-faint">Leave empty for a generalist team that catches everything.</p>
        </div>
      </div>

      {/* Members */}
      <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-ink-strong">Members</h3>
            <p className="text-xs text-ink-muted">
              Reps can belong to multiple teams. <strong className="text-ink-strong">Primary</strong> is the default landing-team for their list view.
            </p>
          </div>
          <Button size="sm" onClick={() => setAddingMember((a) => !a)} disabled={addableReps.length === 0}>
            {addingMember ? <X className="h-3.5 w-3.5 mr-1.5" /> : <UserPlus className="h-3.5 w-3.5 mr-1.5" />}
            {addingMember ? "Cancel" : "Add member"}
          </Button>
        </div>

        {addingMember && (
          <div className="rounded-lg border border-line-subtle bg-surface-2/50 p-3 mb-3 space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={newMemberId}
                onChange={(e) => setNewMemberId(e.target.value)}
                className="h-9 flex-1 min-w-[200px] rounded-md border border-line bg-surface px-2 text-sm text-ink-strong hover:border-line-strong focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-colors"
              >
                <option value="">— pick a rep —</option>
                {addableReps.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} · {r.email}</option>
                ))}
              </select>
              <label className="inline-flex items-center gap-1.5 text-xs text-ink-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={newMemberPrimary}
                  onChange={(e) => setNewMemberPrimary(e.target.checked)}
                  className="accent-gtn-purple h-4 w-4"
                />
                Make this their primary team
              </label>
              <Button size="sm" onClick={addMember} disabled={!newMemberId}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add
              </Button>
            </div>
            {addableReps.length === 0 && (
              <p className="text-xs text-ink-muted italic">
                No more reps to add.{" "}
                <Link href="/sales/reps" className="text-gtn-purple hover:underline font-medium">Hire a new rep →</Link>
              </p>
            )}
          </div>
        )}

        {members.length === 0 ? (
          <p className="text-sm text-ink-faint italic py-3 text-center">
            No members yet — add reps above so they see this team&apos;s leads.
          </p>
        ) : (
          <ul className="divide-y divide-line-subtle -mx-1">
            {members.map((m) => (
              <li key={m.id} className="px-1 py-2.5 flex items-center justify-between gap-3 hover:bg-surface-3/30 -mx-2 px-3 rounded-md transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    aria-hidden
                    className="h-8 w-8 rounded-full bg-brand-soft text-gtn-navy flex items-center justify-center text-[11px] font-semibold flex-shrink-0 border border-line-subtle"
                  >
                    {initials(m.user.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-strong inline-flex items-center gap-1.5">
                      <Link href={`/sales/reps/${m.userId}`} className="hover:text-gtn-purple truncate">
                        {m.user.name}
                      </Link>
                      {m.isPrimary && (
                        <Star className="h-3.5 w-3.5 text-gtn-amber flex-shrink-0" aria-label="Primary team" />
                      )}
                      {!m.user.active && (
                        <Badge tone="danger" shape="pill" size="xs">deactivated</Badge>
                      )}
                    </p>
                    <p className="text-[11px] text-ink-muted font-mono truncate">{m.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge tone="muted" shape="pill" size="xs">{m.role.toLowerCase()}</Badge>
                  <button
                    onClick={() => togglePrimary(m.userId, m.isPrimary)}
                    className={cn(
                      "text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors",
                      m.isPrimary
                        ? "border-gtn-amber/40 text-gtn-amber bg-warn-soft/60 hover:bg-warn-soft"
                        : "border-line-subtle text-ink-muted hover:text-gtn-amber hover:border-gtn-amber/40",
                    )}
                    title={m.isPrimary ? "Click to clear primary" : "Set as their primary team"}
                  >
                    {m.isPrimary ? "primary ✓" : "make primary"}
                  </button>
                  <button
                    onClick={() => removeMember(m.userId, m.user.name)}
                    className="text-ink-faint hover:text-danger transition-colors p-1"
                    aria-label={`Remove ${m.user.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Territories */}
      <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-ink-strong">Territories</h3>
            <p className="text-xs text-ink-muted">Geographic regions this team covers.</p>
          </div>
          <Button asChild size="sm" variant="secondary">
            <Link href={`/sales/territories?teamId=${team.id}`}>Manage territories</Link>
          </Button>
        </div>
        {territories.length === 0 ? (
          <p className="text-sm text-ink-faint italic py-3 text-center">
            No territories yet.{" "}
            <Link href={`/sales/territories?teamId=${team.id}`} className="text-gtn-purple hover:underline font-medium not-italic">
              Add one →
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-line-subtle -mx-1">
            {territories.map((t) => (
              <li key={t.id} className="px-1 py-2.5 flex items-center justify-between gap-3 hover:bg-surface-3/30 -mx-2 px-3 rounded-md transition-colors">
                <div className="min-w-0">
                  <Link
                    href={`/sales/territories/${t.id}`}
                    className="text-sm font-medium text-ink-strong hover:text-gtn-purple"
                  >
                    {t.name}
                  </Link>
                  <p className="text-[11px] text-ink-muted mt-0.5">
                    {t.states.length > 0 && (
                      <>
                        <span className="tabular">{t.states.length}</span>{" "}
                        state{t.states.length === 1 ? "" : "s"}
                      </>
                    )}
                    {t.zipCount > 0 && (
                      <> · <span className="tabular">{t.zipCount}</span> zip{t.zipCount === 1 ? "" : "s"}</>
                    )}
                    {t.cityCount > 0 && (
                      <> · <span className="tabular">{t.cityCount}</span> cit{t.cityCount === 1 ? "y" : "ies"}</>
                    )}
                    {t.states.length === 0 && t.zipCount === 0 && t.cityCount === 0 && "polygon only"}
                  </p>
                </div>
                {!t.active && <Badge tone="muted" shape="pill" size="xs">inactive</Badge>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase();
}

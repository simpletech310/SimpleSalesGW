"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { ServiceLine } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";

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
    if (!name.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/sales-teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, serviceLines }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? "Save failed"); return; }
      toast.success("Team created");
      setName(""); setDescription(""); setServiceLines([]); setCreating(false);
      router.refresh();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating((c) => !c)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          {creating ? "Cancel" : "New team"}
        </Button>
      </div>

      {creating && (
        <Card>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="IT Team" />
            </div>
          </div>
          <div className="space-y-1 mt-3">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this team focuses on." />
          </div>
          <div className="space-y-1 mt-3">
            <Label>Service lines this team sells</Label>
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
            <p className="text-[11px] text-gtn-grey-3 mt-1">Leave empty for a generalist team.</p>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {saving ? "Creating…" : "Create team"}
            </Button>
          </div>
        </Card>
      )}

      {initialTeams.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gtn-lavender text-left text-xs uppercase tracking-wide text-gtn-grey-2">
              <tr>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Service lines</th>
                <th className="px-3 py-3 text-right">Members</th>
                <th className="px-3 py-3 text-right">Territories</th>
                <th className="px-3 py-3 text-right">Leads</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gtn-lavender-2">
              {initialTeams.map((t) => (
                <tr key={t.id} className={t.active ? "" : "opacity-50"}>
                  <td className="px-3 py-2">
                    <Link href={`/sales/teams/${t.id}`} className="text-gtn-purple hover:underline font-medium">
                      {t.name}
                    </Link>
                    {t.description && <p className="text-xs text-gtn-grey-2 mt-0.5">{t.description}</p>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {t.serviceLines.length === 0 ? (
                      <span className="text-gtn-grey-3 italic">All services</span>
                    ) : (
                      <span className="text-gtn-navy">{t.serviceLines.map((s) => s.replace(/_/g, " ")).join(", ")}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{t.memberCount}</td>
                  <td className="px-3 py-2 text-right font-mono">{t.territoryCount}</td>
                  <td className="px-3 py-2 text-right font-mono">{t.leadCount}</td>
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

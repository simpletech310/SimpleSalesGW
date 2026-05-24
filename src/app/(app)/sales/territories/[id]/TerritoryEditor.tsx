"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { TerritoryPolygonEditor } from "./TerritoryPolygonEditor";

type CityEntry = { city: string; state: string };
type Polygon = { type: "Polygon"; coordinates: number[][][] } | null;

export function TerritoryEditor({
  territory,
  teams,
}: {
  territory: {
    id: string;
    name: string;
    teamId: string;
    states: string[];
    zipCodes: string[];
    cities: CityEntry[];
    polygon: Polygon;
    active: boolean;
  };
  teams: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [name, setName] = useState(territory.name);
  const [teamId, setTeamId] = useState(territory.teamId);
  const [active, setActive] = useState(territory.active);
  const [states, setStates] = useState<string[]>(territory.states);
  const [zipCodes, setZipCodes] = useState<string[]>(territory.zipCodes);
  const [cities, setCities] = useState<CityEntry[]>(territory.cities);
  const [polygon, setPolygon] = useState<Polygon>(territory.polygon);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  function markDirty() { setDirty(true); }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/sales-territories/${territory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          teamId,
          states: states.filter((s) => s.trim()),
          zipCodes: zipCodes.filter((z) => z.trim()),
          cities: cities.filter((c) => c.city.trim() && c.state.trim()),
          polygon,
          active,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? "Save failed"); return; }
      toast.success("Territory saved");
      setDirty(false);
      router.refresh();
    } finally { setSaving(false); }
  }

  async function archive() {
    if (!confirm(`Archive territory "${territory.name}"?`)) return;
    const res = await fetch(`/api/sales-territories/${territory.id}`, { method: "DELETE" });
    if (!res.ok) { const data = await res.json().catch(() => ({})); toast.error(data?.error ?? "Archive failed"); return; }
    toast.success("Archived");
    router.push("/sales/territories");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card className="sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-gtn-navy">Territory settings</h2>
            <p className="text-xs text-gtn-grey-2">
              {states.length} states · {zipCodes.length} zips · {cities.length} cities · polygon: {polygon ? "yes" : "no"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={archive}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Archive
            </Button>
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => { setName(e.target.value); markDirty(); }} />
          </div>
          <div className="space-y-1">
            <Label>Team</Label>
            <select value={teamId} onChange={(e) => { setTeamId(e.target.value); markDirty(); }} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-sm mt-3">
          <input type="checkbox" checked={active} onChange={(e) => { setActive(e.target.checked); markDirty(); }} />
          Active
        </label>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-gtn-navy mb-1">States</h3>
        <p className="text-xs text-gtn-grey-2 mb-2">2-letter codes (CA, AZ, NV…). Lead with matching state matches.</p>
        <ListEditor values={states} onChange={(v) => { setStates(v); markDirty(); }} placeholder="CA" maxLen={2} />
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-gtn-navy mb-1">Zip codes</h3>
        <p className="text-xs text-gtn-grey-2 mb-2">Paste many at once (one per line) — they get split + trimmed on save.</p>
        <BulkListEditor values={zipCodes} onChange={(v) => { setZipCodes(v); markDirty(); }} placeholder="91501&#10;91502&#10;91503" />
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-gtn-navy mb-1">Cities</h3>
        <p className="text-xs text-gtn-grey-2 mb-2">City + state. Both required for a match.</p>
        <CityListEditor values={cities} onChange={(v) => { setCities(v); markDirty(); }} />
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-gtn-navy mb-1">Polygon</h3>
        <p className="text-xs text-gtn-grey-2 mb-2">
          Draw a polygon on the map to define a free-form coverage shape. Any lead with lat/lng inside the polygon matches. Use list dimensions above for legacy leads without geocodes.
        </p>
        <TerritoryPolygonEditor value={polygon} onChange={(p) => { setPolygon(p); markDirty(); }} />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ListEditor({
  values, onChange, placeholder, maxLen,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  maxLen?: number;
}) {
  function update(i: number, v: string) {
    onChange(values.map((x, idx) => (idx === i ? (maxLen ? v.slice(0, maxLen).toUpperCase() : v) : x)));
  }
  function add() { onChange([...values, ""]); }
  function remove(i: number) { onChange(values.filter((_, idx) => idx !== i)); }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={add}><Plus className="h-3.5 w-3.5 mr-1" /> Add</Button>
      </div>
      {values.length === 0 ? (
        <p className="text-xs text-gtn-grey-2 italic">None.</p>
      ) : (
        <ul className="space-y-2">
          {values.map((v, i) => (
            <li key={i} className="flex items-center gap-2">
              <Input value={v} onChange={(e) => update(i, e.target.value)} placeholder={placeholder} className="max-w-[120px]" />
              <button onClick={() => remove(i)} className="text-gtn-grey-2 hover:text-gtn-red" aria-label="Remove">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BulkListEditor({
  values, onChange, placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(values.join("\n"));
  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(
            e.target.value
              .split(/[\n,\s]+/)
              .map((s) => s.trim())
              .filter(Boolean),
          );
        }}
        rows={6}
        placeholder={placeholder}
        className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm font-mono"
      />
      <p className="text-[11px] text-gtn-grey-3">{values.length} entr{values.length === 1 ? "y" : "ies"}.</p>
    </div>
  );
}

function CityListEditor({
  values, onChange,
}: {
  values: Array<{ city: string; state: string }>;
  onChange: (v: Array<{ city: string; state: string }>) => void;
}) {
  function update(i: number, patch: Partial<{ city: string; state: string }>) {
    onChange(values.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }
  function add() { onChange([...values, { city: "", state: "CA" }]); }
  function remove(i: number) { onChange(values.filter((_, idx) => idx !== i)); }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={add}><Plus className="h-3.5 w-3.5 mr-1" /> Add city</Button>
      </div>
      {values.length === 0 ? (
        <p className="text-xs text-gtn-grey-2 italic">None.</p>
      ) : (
        <ul className="space-y-2">
          {values.map((v, i) => (
            <li key={i} className="flex items-center gap-2">
              <Input
                value={v.city}
                onChange={(e) => update(i, { city: e.target.value })}
                placeholder="Burbank"
                className="flex-1"
              />
              <Input
                value={v.state}
                onChange={(e) => update(i, { state: e.target.value.slice(0, 2).toUpperCase() })}
                placeholder="CA"
                className="max-w-[80px]"
              />
              <button onClick={() => remove(i)} className="text-gtn-grey-2 hover:text-gtn-red" aria-label="Remove">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

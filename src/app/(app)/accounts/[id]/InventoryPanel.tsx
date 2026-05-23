"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  INVENTORY_ENTITIES,
  INVENTORY_FIELDS,
  INVENTORY_LABELS,
  type FieldDef,
  type InventoryEntityKey,
} from "@/lib/inventory/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Row = Record<string, unknown> & { id: string };

export function InventoryPanel({ customerId }: { customerId: string }) {
  const [active, setActive] = useState<InventoryEntityKey>("sites");
  return (
    <div className="space-y-4">
      <div className="-mx-4 px-4 overflow-x-auto md:mx-0 md:px-0">
        <div className="flex gap-1 min-w-max">
          {INVENTORY_ENTITIES.map((e) => (
            <button
              key={e}
              onClick={() => setActive(e)}
              className={
                active === e
                  ? "px-3 py-2 text-xs font-semibold rounded-md bg-gtn-navy text-white"
                  : "px-3 py-2 text-xs rounded-md text-gtn-grey-2 hover:bg-gtn-lavender"
              }
            >
              {INVENTORY_LABELS[e]}
            </button>
          ))}
        </div>
      </div>
      <InventoryTable customerId={customerId} entity={active} key={active} />
    </div>
  );
}

function InventoryTable({ customerId, entity }: { customerId: string; entity: InventoryEntityKey }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sites, setSites] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fields = INVENTORY_FIELDS[entity];

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/accounts/${customerId}/inventory/${entity}`);
    const data = await res.json();
    if (res.ok) setRows(data.rows);
  }, [customerId, entity]);

  const loadSites = useCallback(async () => {
    if (entity === "sites") { setSites([]); return; }
    const res = await fetch(`/api/accounts/${customerId}/inventory/sites`);
    const data = await res.json();
    if (res.ok) setSites(data.rows);
  }, [customerId, entity]);

  useEffect(() => {
    void refresh();
    void loadSites();
  }, [refresh, loadSites]);

  const siteOptions = useMemo(
    () => [{ value: "", label: "— none —" }, ...sites.map((s) => ({ value: s.id, label: String(s.name ?? s.id) }))],
    [sites],
  );

  function fieldOptions(f: FieldDef) {
    if (f.key === "siteId") return siteOptions;
    return f.options ?? [];
  }

  async function createRow(form: HTMLFormElement) {
    setSaving(true);
    try {
      const fd = new FormData(form);
      const body: Record<string, unknown> = {};
      for (const f of fields) {
        const v = fd.get(f.key);
        if (v === null) continue;
        if (f.type === "boolean") body[f.key] = v === "on" || v === "true";
        else if (v === "") continue;
        else body[f.key] = v;
      }
      const res = await fetch(`/api/accounts/${customerId}/inventory/${entity}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data?.error ?? "Failed");
      else {
        toast.success("Added");
        setOpen(false);
        form.reset();
        await refresh();
        if (entity === "sites") await loadSites();
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this row?")) return;
    const res = await fetch(`/api/accounts/${customerId}/inventory/${entity}/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error ?? "Delete failed");
      return;
    }
    toast.success("Deleted");
    await refresh();
    if (entity === "sites") await loadSites();
    router.refresh();
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gtn-navy">{INVENTORY_LABELS[entity]}</h3>
        <Button size="sm" onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ Add row"}</Button>
      </div>

      {open && (
        <form
          onSubmit={(e) => { e.preventDefault(); void createRow(e.currentTarget); }}
          className="space-y-3 mb-4 p-3 rounded-md bg-gtn-lavender"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="text-xs text-gtn-grey-2">{f.label}{f.required && <span className="text-gtn-red ml-1">*</span>}</label>
                {f.type === "string" || f.type === "number" || f.type === "decimal" ? (
                  <Input
                    name={f.key}
                    type={f.type === "number" || f.type === "decimal" ? "number" : "text"}
                    step={f.type === "decimal" ? "0.01" : undefined}
                    required={f.required}
                  />
                ) : f.type === "boolean" ? (
                  <input type="checkbox" name={f.key} className="accent-gtn-purple" />
                ) : f.type === "date" ? (
                  <Input name={f.key} type="date" />
                ) : f.type === "select" ? (
                  <select name={f.key} className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
                    {fieldOptions(f).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : null}
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add"}</Button>
          </div>
        </form>
      )}

      {rows === null ? (
        <p className="text-sm text-gtn-grey-2">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gtn-grey-2">No rows yet — click <strong>+ Add row</strong> to start.</p>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gtn-grey-2 uppercase tracking-wide">
                {fields.map((f) => <th key={f.key} className="px-2 py-2 font-medium">{f.label}</th>)}
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-gtn-lavender-2">
                  {fields.map((f) => (
                    <td key={f.key} className="px-2 py-2 text-gtn-navy align-top">
                      {renderCell(r[f.key], f, sites)}
                    </td>
                  ))}
                  <td className="px-2 py-2 align-top">
                    <button onClick={() => remove(r.id)} className="text-gtn-red hover:underline">delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function renderCell(value: unknown, field: FieldDef, sites: Row[]): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-gtn-grey-3">—</span>;
  if (field.key === "siteId") {
    const s = sites.find((x) => x.id === value);
    return s ? String(s.name ?? value) : <span className="text-gtn-grey-3">{String(value).slice(0, 8)}…</span>;
  }
  if (field.type === "boolean") return value ? "✓" : "✗";
  if (field.type === "date") return value ? new Date(value as string).toLocaleDateString() : "—";
  if (field.type === "decimal") return typeof value === "object" ? Number(value).toString() : String(value);
  return String(value);
}

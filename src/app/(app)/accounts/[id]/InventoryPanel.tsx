"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import {
  INVENTORY_ENTITIES,
  INVENTORY_FIELDS,
  INVENTORY_LABELS,
  type FieldDef,
  type InventoryEntityKey,
} from "@/lib/inventory/types";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

type Row = Record<string, unknown> & { id: string };

/**
 * v3.1.4 — Inventory panel on v3 tokens.
 */
export function InventoryPanel({ customerId }: { customerId: string }) {
  const [active, setActive] = useState<InventoryEntityKey>("sites");
  return (
    <div className="space-y-4">
      {/* Entity selector */}
      <div className="-mx-4 px-4 overflow-x-auto md:mx-0 md:px-0">
        <div className="flex gap-1 min-w-max">
          {INVENTORY_ENTITIES.map((e) => (
            <button
              key={e}
              onClick={() => setActive(e)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-full font-medium transition-colors duration-120 ease-smooth",
                active === e
                  ? "bg-gtn-navy text-white"
                  : "bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink-strong border border-line-subtle",
              )}
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
    <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink-strong">{INVENTORY_LABELS[entity]}</h3>
        <Button size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? <X className="h-3.5 w-3.5 mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
          {open ? "Cancel" : "Add row"}
        </Button>
      </div>

      {open && (
        <form
          onSubmit={(e) => { e.preventDefault(); void createRow(e.currentTarget); }}
          className="space-y-3 mb-4 p-4 rounded-lg border border-line-subtle bg-surface-2/50"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs">
                  {f.label}
                  {f.required && <span className="text-danger ml-1">*</span>}
                </Label>
                {f.type === "string" || f.type === "number" || f.type === "decimal" ? (
                  <Input
                    name={f.key}
                    type={f.type === "number" || f.type === "decimal" ? "number" : "text"}
                    step={f.type === "decimal" ? "0.01" : undefined}
                    required={f.required}
                    className="h-9 text-sm"
                  />
                ) : f.type === "boolean" ? (
                  <input type="checkbox" name={f.key} className="accent-gtn-purple h-4 w-4" />
                ) : f.type === "date" ? (
                  <Input name={f.key} type="date" className="h-9 text-sm" />
                ) : f.type === "select" ? (
                  <select
                    name={f.key}
                    className="flex h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink-strong hover:border-line-strong focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-colors"
                  >
                    {fieldOptions(f).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : null}
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-2 border-t border-line-subtle">
            <Button type="submit" size="sm" disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {saving ? "Saving…" : "Add row"}
            </Button>
          </div>
        </form>
      )}

      {rows === null ? (
        <div className="flex items-center justify-center py-8 text-sm text-ink-muted">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-faint italic py-6 text-center">
          No rows yet — click <strong className="text-ink-muted not-italic">Add row</strong> to start.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 rounded-lg border border-line-subtle">
          <table className="w-full text-xs">
            <thead className="bg-surface-2">
              <tr>
                {fields.map((f) => (
                  <th key={f.key} className="ui-label text-left px-3 py-2.5">{f.label}</th>
                ))}
                <th className="px-3 py-2.5 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line-subtle hover:bg-surface-3/30 transition-colors">
                  {fields.map((f) => (
                    <td key={f.key} className="px-3 py-2.5 text-ink-strong align-top">
                      {renderCell(r[f.key], f, sites)}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 align-top">
                    <button
                      onClick={() => remove(r.id)}
                      className="text-ink-faint hover:text-danger transition-colors"
                      aria-label="Delete row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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

function renderCell(value: unknown, field: FieldDef, sites: Row[]): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-ink-faint">—</span>;
  if (field.key === "siteId") {
    const s = sites.find((x) => x.id === value);
    return s ? (
      String(s.name ?? value)
    ) : (
      <span className="text-ink-faint font-mono">{String(value).slice(0, 8)}…</span>
    );
  }
  if (field.type === "boolean") {
    return value
      ? <span className="text-gtn-green">✓</span>
      : <span className="text-ink-faint">✗</span>;
  }
  if (field.type === "date") return value ? new Date(value as string).toLocaleDateString() : "—";
  if (field.type === "decimal") return typeof value === "object" ? Number(value).toString() : String(value);
  return String(value);
}

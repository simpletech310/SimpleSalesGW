"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { ServiceBundle, ServiceLine } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";
import {
  fmtUsd,
  normalizeInclude,
  type BundleDefinition,
  type PricingCatalog,
  type SeatTier,
  type ServiceLineInclude,
} from "@/lib/pricing/catalog";
import { LINE_ITEM_STICKERS } from "@/lib/pricing/deal-kinds";

/**
 * v2.19 — Form-based pricing editor.
 *
 * Replaces the raw JSON textarea with a tabbed, organized UI:
 *   - Bundles tab: per-bundle accordion with editable seat tiers, onboarding,
 *     includes (service lines + sub-tiers), annual add-ons, label, description
 *   - Standalone tab: editable per-seat MRR / floor / one-time for every
 *     ServiceLine
 *   - Per-unit reference tab: read-only view of v2.15 LINE_ITEM_STICKERS
 *     (voice extensions, cable drops, doors, cameras, NVR, labor) — these
 *     live in src/lib/pricing/deal-kinds.ts; editing them is a future round
 *   - Advanced tab: raw JSON editor preserved as a fallback for power users
 *
 * Save assembles the form state back into a PricingCatalog and POSTs to
 * /api/admin/pricing (unchanged contract).
 */

const BUNDLE_ORDER: ServiceBundle[] = [
  ServiceBundle.ESSENTIAL,
  ServiceBundle.PROFESSIONAL,
  ServiceBundle.COMPLIANCE_PLUS,
  ServiceBundle.ENTERPRISE,
  ServiceBundle.CUSTOM,
];

const ALL_SERVICE_LINES: ServiceLine[] = [
  ServiceLine.MANAGED_IT,
  ServiceLine.CYBERSECURITY,
  ServiceLine.VOIP,
  ServiceLine.CABLING,
  ServiceLine.ACCESS_CONTROL,
  ServiceLine.VIDEO,
  ServiceLine.NIST_ASSESSMENT,
  ServiceLine.AI_ADVISORY,
  ServiceLine.VCIO_RETAINER,
];

type Tab = "bundles" | "standalone" | "perUnit" | "advanced";

export function PricingEditor({
  initialCatalog,
  defaultCatalog,
}: {
  initialCatalog: PricingCatalog;
  defaultCatalog: PricingCatalog;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("bundles");
  const [catalog, setCatalog] = useState<PricingCatalog>(initialCatalog);
  const [rawText, setRawText] = useState<string>(() => JSON.stringify(initialCatalog, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function markDirty() {
    setDirty(true);
  }

  // Sync raw JSON ↔ form state when the user toggles to/from Advanced.
  function switchTab(next: Tab) {
    if (tab === "advanced" && next !== "advanced") {
      // Parse raw text into form state when leaving advanced
      try {
        const parsed = JSON.parse(rawText) as PricingCatalog;
        setCatalog(parsed);
        setParseError(null);
      } catch (err) {
        setParseError((err as Error).message);
        toast.error("JSON has errors — fix them or use Reset before leaving Advanced.");
        return;
      }
    }
    if (tab !== "advanced" && next === "advanced") {
      // Re-serialize form state when entering advanced
      setRawText(JSON.stringify(catalog, null, 2));
    }
    setTab(next);
  }

  async function save() {
    setSaving(true);
    try {
      let payload = catalog;
      if (tab === "advanced") {
        try {
          payload = JSON.parse(rawText) as PricingCatalog;
        } catch (err) {
          setParseError((err as Error).message);
          toast.error("Fix JSON syntax first.");
          return;
        }
      }
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        // v2.20.1 — surface the first field-level Zod issue so the user can
        // see *which* part of the catalog failed, not just "Validation failed".
        const flatten = data?.details as { fieldErrors?: Record<string, string[]>; formErrors?: string[] } | undefined;
        const firstFieldError = flatten?.fieldErrors
          ? Object.entries(flatten.fieldErrors).find(([, msgs]) => msgs?.length)
          : undefined;
        const detail = firstFieldError
          ? `${firstFieldError[0]}: ${firstFieldError[1][0]}`
          : flatten?.formErrors?.[0];
        toast.error(detail ? `${data.error}: ${detail}` : (data?.error ?? "Save failed"), { duration: 8000 });
      } else {
        toast.success("Pricing catalog updated");
        setCatalog(payload);
        setRawText(JSON.stringify(payload, null, 2));
        setDirty(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  function resetToDefaults() {
    if (!confirm("Replace the editor with the committed defaults? (Not saved until you click Save.)")) return;
    setCatalog(defaultCatalog);
    setRawText(JSON.stringify(defaultCatalog, null, 2));
    setParseError(null);
    markDirty();
  }

  // Helpers to mutate the in-memory catalog
  function updateBundle(id: ServiceBundle, patch: Partial<BundleDefinition>) {
    setCatalog((c) => ({
      ...c,
      bundles: { ...c.bundles, [id]: { ...c.bundles[id], ...patch } },
    }));
    markDirty();
  }
  function updateStandalone(line: ServiceLine, patch: Partial<{ perSeatMrr: number; perSeatFloor: number; oneTime: number }>) {
    setCatalog((c) => {
      const existing = c.standalone[line] ?? { perSeatMrr: 0, perSeatFloor: 0, oneTime: 0 };
      return { ...c, standalone: { ...c.standalone, [line]: { ...existing, ...patch } } };
    });
    markDirty();
  }

  return (
    <div className="space-y-4">
      {/* Sticky toolbar */}
      <Card className="sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gtn-navy">Edit catalog</h2>
            <p className="text-xs text-gtn-grey-2 mt-0.5">
              Saved to <code className="gtn-code-pill">SystemConfig.pricing.catalog</code>.
              Propagates to every quote, PricingCard, and approval-tier calc instantly.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={resetToDefaults}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset to defaults
            </Button>
            <Button onClick={save} disabled={saving || (!dirty && tab !== "advanced")}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gtn-lavender-2">
        {([
          { key: "bundles", label: "Bundles", count: Object.keys(catalog.bundles).length },
          { key: "standalone", label: "Standalone lines", count: Object.keys(catalog.standalone).length },
          { key: "perUnit", label: "Per-unit (reference)", count: Object.keys(LINE_ITEM_STICKERS).length },
          { key: "advanced", label: "Advanced JSON", count: null },
        ] as Array<{ key: Tab; label: string; count: number | null }>).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => switchTab(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.key
                ? "border-gtn-purple text-gtn-navy"
                : "border-transparent text-gtn-grey-2 hover:text-gtn-navy"
            }`}
          >
            {t.label}
            {t.count != null && (
              <span className="ml-1.5 text-xs text-gtn-grey-3 font-mono">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "bundles" && (
        <BundlesEditor
          catalog={catalog}
          onBundleChange={updateBundle}
        />
      )}

      {tab === "standalone" && (
        <StandaloneEditor catalog={catalog} onChange={updateStandalone} />
      )}

      {tab === "perUnit" && <PerUnitReference />}

      {tab === "advanced" && (
        <Card>
          <div className="flex items-start justify-between mb-2 gap-2 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-gtn-navy">Raw JSON editor</h3>
              <p className="text-xs text-gtn-grey-2 mt-0.5">
                For bulk edits or pasting a known-good catalog from a backup. Form-tab changes are merged in when you switch back.
              </p>
            </div>
          </div>
          <textarea
            value={rawText}
            onChange={(e) => { setRawText(e.target.value); setParseError(null); markDirty(); }}
            rows={28}
            spellCheck={false}
            className="w-full font-mono text-xs rounded-md border border-input bg-white px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {parseError && (
            <p className="text-xs text-gtn-red mt-2">JSON error: {parseError}</p>
          )}
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bundles editor
// ---------------------------------------------------------------------------

function BundlesEditor({
  catalog,
  onBundleChange,
}: {
  catalog: PricingCatalog;
  onBundleChange: (id: ServiceBundle, patch: Partial<BundleDefinition>) => void;
}) {
  return (
    <div className="space-y-3">
      {BUNDLE_ORDER.map((id) => {
        const b = catalog.bundles[id];
        if (!b) return null;
        return <BundleAccordion key={id} bundle={b} onChange={(patch) => onBundleChange(id, patch)} />;
      })}
    </div>
  );
}

function BundleAccordion({
  bundle,
  onChange,
}: {
  bundle: BundleDefinition;
  onChange: (patch: Partial<BundleDefinition>) => void;
}) {
  const [open, setOpen] = useState(false);

  const summary = useMemo(() => {
    if (bundle.seatTiers.length === 0) return "Custom / scope-per-engagement";
    const t = bundle.seatTiers[0]!;
    const lastTier = bundle.seatTiers[bundle.seatTiers.length - 1]!;
    return `${fmtUsd(t.perSeatMrr)}–${fmtUsd(lastTier.perSeatMrr)} /seat · ${bundle.seatTiers.length} tier${bundle.seatTiers.length === 1 ? "" : "s"}`;
  }, [bundle]);

  return (
    <Card className="p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gtn-lavender/40 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="h-4 w-4 text-gtn-grey-2 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-gtn-grey-2 flex-shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gtn-navy">{bundle.label}</p>
            <p className="text-xs text-gtn-grey-2 truncate">{summary}</p>
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-wide bg-gtn-lavender text-gtn-purple rounded-full px-2 py-0.5 flex-shrink-0">
          {bundle.id.replace(/_/g, " ")}
        </span>
      </button>

      {open && (
        <div className="px-4 py-4 border-t border-gtn-lavender-2 space-y-4">
          {/* Label + description */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`label-${bundle.id}`}>Display label</Label>
              <Input
                id={`label-${bundle.id}`}
                value={bundle.label}
                onChange={(e) => onChange({ label: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Bundle ID (locked)</Label>
              <Input value={bundle.id} disabled className="bg-gtn-lavender-2 text-gtn-grey-2" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`desc-${bundle.id}`}>Description</Label>
            <Textarea
              id={`desc-${bundle.id}`}
              value={bundle.description}
              rows={2}
              onChange={(e) => onChange({ description: e.target.value })}
            />
          </div>

          {/* Seat tiers */}
          <SeatTiersEditor
            tiers={bundle.seatTiers}
            onChange={(seatTiers) => onChange({ seatTiers })}
          />

          {/* Onboarding */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`ob-base-${bundle.id}`}>Onboarding — base ($)</Label>
              <Input
                id={`ob-base-${bundle.id}`}
                type="number"
                min={0}
                value={bundle.onboarding.base}
                onChange={(e) => onChange({ onboarding: { ...bundle.onboarding, base: Number(e.target.value) || 0 } })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`ob-perseat-${bundle.id}`}>Onboarding — per seat ($)</Label>
              <Input
                id={`ob-perseat-${bundle.id}`}
                type="number"
                min={0}
                value={bundle.onboarding.perSeat}
                onChange={(e) => onChange({ onboarding: { ...bundle.onboarding, perSeat: Number(e.target.value) || 0 } })}
              />
            </div>
          </div>

          {/* Annual add-ons */}
          <AnnualAddOnsEditor
            items={bundle.annualAddOns ?? []}
            onChange={(annualAddOns) => onChange({ annualAddOns })}
          />

          {/* Includes */}
          <IncludesEditor
            items={bundle.includes}
            onChange={(includes) => onChange({ includes })}
          />
        </div>
      )}
    </Card>
  );
}

function SeatTiersEditor({
  tiers,
  onChange,
}: {
  tiers: ReadonlyArray<SeatTier>;
  onChange: (next: ReadonlyArray<SeatTier>) => void;
}) {
  function update(i: number, patch: Partial<SeatTier>) {
    onChange(tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function add() {
    const last = tiers[tiers.length - 1];
    const min = last ? last.maxSeats + 1 : 10;
    onChange([
      ...tiers,
      { minSeats: min, maxSeats: min + 24, perSeatMrr: 100, perSeatFloor: 80 },
    ]);
  }
  function remove(i: number) {
    onChange(tiers.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Per-seat tiers</Label>
        <Button type="button" variant="ghost" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add tier
        </Button>
      </div>
      {tiers.length === 0 ? (
        <p className="text-xs text-gtn-grey-2 italic">No tiers — pricing scoped per engagement.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[480px]">
            <thead className="text-left uppercase tracking-wide text-gtn-grey-2">
              <tr>
                <th className="py-1 w-20">Min seats</th>
                <th className="py-1 w-20">Max seats</th>
                <th className="py-1 w-24">Sticker MRR</th>
                <th className="py-1 w-24">Floor MRR</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t, i) => (
                <tr key={i} className="border-t border-gtn-lavender-2">
                  <td className="py-1 pr-2">
                    <Input
                      type="number"
                      min={1}
                      value={t.minSeats}
                      onChange={(e) => update(i, { minSeats: Number(e.target.value) || 0 })}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      type="number"
                      min={1}
                      value={t.maxSeats}
                      onChange={(e) => update(i, { maxSeats: Number(e.target.value) || 0 })}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      type="number"
                      min={0}
                      value={t.perSeatMrr}
                      onChange={(e) => update(i, { perSeatMrr: Number(e.target.value) || 0 })}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      type="number"
                      min={0}
                      value={t.perSeatFloor}
                      onChange={(e) => update(i, { perSeatFloor: Number(e.target.value) || 0 })}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="py-1">
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="text-gtn-grey-2 hover:text-gtn-red"
                      aria-label="Remove tier"
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

function AnnualAddOnsEditor({
  items,
  onChange,
}: {
  items: ReadonlyArray<{ label: string; amount: number }>;
  onChange: (next: ReadonlyArray<{ label: string; amount: number }>) => void;
}) {
  function update(i: number, patch: Partial<{ label: string; amount: number }>) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function add() {
    onChange([...items, { label: "New annual add-on", amount: 0 }]);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Annual add-ons (one per year)</Label>
        <Button type="button" variant="ghost" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gtn-grey-2 italic">No annual add-ons.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-2">
              <Input
                value={it.label}
                onChange={(e) => update(i, { label: e.target.value })}
                className="h-8 text-xs flex-1"
                placeholder="Annual NIST CSF assessment"
              />
              <Input
                type="number"
                min={0}
                value={it.amount}
                onChange={(e) => update(i, { amount: Number(e.target.value) || 0 })}
                className="h-8 text-xs w-28"
                placeholder="0"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-gtn-grey-2 hover:text-gtn-red"
                aria-label="Remove add-on"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IncludesEditor({
  items,
  onChange,
}: {
  items: ReadonlyArray<ServiceLineInclude>;
  onChange: (next: ReadonlyArray<ServiceLineInclude>) => void;
}) {
  // Normalize internally to {serviceLine, tier?} for editing
  const rows = items.map(normalizeInclude);

  function update(i: number, patch: Partial<{ serviceLine: ServiceLine; tier: string }>) {
    onChange(
      rows.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, ...patch };
        return next.tier ? { serviceLine: next.serviceLine, tier: next.tier } : { serviceLine: next.serviceLine };
      }),
    );
  }
  function add() {
    onChange([...rows, { serviceLine: ServiceLine.MANAGED_IT }]);
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>What&apos;s included (service lines)</Label>
        <Button type="button" variant="ghost" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add line
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-gtn-grey-2 italic">No service lines defined for this bundle yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-2 flex-wrap">
              <select
                value={r.serviceLine}
                onChange={(e) => update(i, { serviceLine: e.target.value as ServiceLine })}
                className="h-8 rounded-md border border-input bg-white px-2 text-xs flex-1 min-w-[160px]"
              >
                {ALL_SERVICE_LINES.map((sl) => (
                  <option key={sl} value={sl}>{sl.replace(/_/g, " ")}</option>
                ))}
              </select>
              <Input
                value={r.tier ?? ""}
                onChange={(e) => update(i, { tier: e.target.value })}
                placeholder="Sub-tier (optional, e.g. 'Complete')"
                className="h-8 text-xs flex-1 min-w-[160px]"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-gtn-grey-2 hover:text-gtn-red"
                aria-label="Remove line"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Standalone editor
// ---------------------------------------------------------------------------

function StandaloneEditor({
  catalog,
  onChange,
}: {
  catalog: PricingCatalog;
  onChange: (line: ServiceLine, patch: Partial<{ perSeatMrr: number; perSeatFloor: number; oneTime: number }>) => void;
}) {
  return (
    <Card>
      <h3 className="text-sm font-semibold text-gtn-navy mb-1">Standalone service-line pricing</h3>
      <p className="text-xs text-gtn-grey-2 mb-4">
        Per-seat MRR + one-time when sold line-by-line (no bundle discount). Edit any cell;
        Save commits all changes at once.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="text-left text-gtn-grey-2 border-b border-gtn-lavender-2">
            <tr>
              <th className="py-2 pr-3 font-medium">Service line</th>
              <th className="py-2 pr-3 font-medium w-32">Per-seat MRR</th>
              <th className="py-2 pr-3 font-medium w-32">Floor / seat</th>
              <th className="py-2 font-medium w-32">One-time setup</th>
            </tr>
          </thead>
          <tbody>
            {ALL_SERVICE_LINES.map((line) => {
              const entry = catalog.standalone[line] ?? { perSeatMrr: 0, perSeatFloor: 0, oneTime: 0 };
              return (
                <tr key={line} className="border-b border-gtn-lavender-2 last:border-0">
                  <td className="py-2 pr-3 font-medium text-gtn-navy">{line.replace(/_/g, " ")}</td>
                  <td className="py-2 pr-3">
                    <Input
                      type="number"
                      min={0}
                      value={entry.perSeatMrr}
                      onChange={(e) => onChange(line, { perSeatMrr: Number(e.target.value) || 0 })}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      type="number"
                      min={0}
                      value={entry.perSeatFloor}
                      onChange={(e) => onChange(line, { perSeatFloor: Number(e.target.value) || 0 })}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="py-2">
                    <Input
                      type="number"
                      min={0}
                      value={entry.oneTime}
                      onChange={(e) => onChange(line, { oneTime: Number(e.target.value) || 0 })}
                      className="h-8 text-xs"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Per-unit reference (read-only for v2.19; in-code edit only)
// ---------------------------------------------------------------------------

function PerUnitReference() {
  return (
    <Card>
      <h3 className="text-sm font-semibold text-gtn-navy mb-1">Per-unit line-item stickers</h3>
      <p className="text-xs text-gtn-grey-2 mb-4">
        Voice extensions, cable drops, door readers, cameras, NVR, install labor. Used by
        the ServiceQuoteCard line-item builder on non-bundle deals and by the v2.17
        pre-sale scoring engines. <strong>Read-only here</strong> — these live in{" "}
        <code className="gtn-code-pill">src/lib/pricing/deal-kinds.ts</code> and editing
        them from the UI is on the roadmap.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="text-left text-gtn-grey-2 border-b border-gtn-lavender-2">
            <tr>
              <th className="py-2 pr-3 font-medium">Line item</th>
              <th className="py-2 pr-3 font-medium text-right">MRR each</th>
              <th className="py-2 pr-3 font-medium text-right">One-time each</th>
              <th className="py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(LINE_ITEM_STICKERS).map(([key, s]) => (
              <tr key={key} className="border-b border-gtn-lavender-2 last:border-0 align-top">
                <td className="py-2 pr-3 font-medium text-gtn-navy">{s.label}</td>
                <td className="py-2 pr-3 text-right font-mono">{s.perUnitMrr > 0 ? fmtUsd(s.perUnitMrr) : "—"}</td>
                <td className="py-2 pr-3 text-right font-mono">{s.perUnitOneTime > 0 ? fmtUsd(s.perUnitOneTime) : "—"}</td>
                <td className="py-2 text-xs text-gtn-grey-2">{s.helpText}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

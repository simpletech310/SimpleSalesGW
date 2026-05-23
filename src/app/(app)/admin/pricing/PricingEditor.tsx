"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { PricingCatalog } from "@/lib/pricing/catalog";

export function PricingEditor({
  initialCatalog,
  defaultCatalog,
}: {
  initialCatalog: PricingCatalog;
  defaultCatalog: PricingCatalog;
}) {
  const router = useRouter();
  const [text, setText] = useState<string>(() => JSON.stringify(initialCatalog, null, 2));
  const [saving, setSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  function validate(): PricingCatalog | null {
    try {
      const parsed = JSON.parse(text) as PricingCatalog;
      setParseError(null);
      return parsed;
    } catch (err) {
      setParseError((err as Error).message);
      return null;
    }
  }

  async function save() {
    const parsed = validate();
    if (!parsed) {
      toast.error("Fix JSON syntax first");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Save failed");
      } else {
        toast.success("Pricing catalog updated");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  function resetToDefaults() {
    if (!confirm("Replace the editor contents with the committed defaults? (Not saved until you click Save.)")) return;
    setText(JSON.stringify(defaultCatalog, null, 2));
    setParseError(null);
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gtn-navy">Edit catalog (JSON)</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={resetToDefaults}>Reset to defaults</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>
      <p className="text-xs text-gtn-grey-2 mb-3">
        Edit the JSON below to override defaults. Saved values are stored in <code className="gtn-code-pill">SystemConfig.key = &quot;pricing.catalog&quot;</code> and read on every quote.
      </p>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setParseError(null); }}
        rows={32}
        spellCheck={false}
        className="w-full font-mono text-xs rounded-md border border-input bg-white px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {parseError && (
        <p className="text-xs text-gtn-red mt-2">JSON error: {parseError}</p>
      )}
    </Card>
  );
}

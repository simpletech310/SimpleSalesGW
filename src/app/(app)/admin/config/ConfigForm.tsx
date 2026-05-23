"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

export function ConfigForm({
  servicesBelow,
  dealQualityBelow,
}: {
  servicesBelow: number;
  dealQualityBelow: number;
}) {
  const [s, setS] = useState(servicesBelow);
  const [d, setD] = useState(dealQualityBelow);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/config/thresholds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servicesBelow: s, dealQualityBelow: d }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? "Failed");
      } else {
        toast.success("Thresholds saved");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Non-strategic flag thresholds</h2>
      <p className="text-xs text-gtn-grey-2">A deal is flagged non-strategic when the services score falls below the first number OR the deal-quality score falls below the second.</p>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Services Score below</Label>
          <Input type="number" min={0} max={100} value={s} onChange={(e) => setS(Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label>Deal Quality Score below</Label>
          <Input type="number" min={0} max={100} value={d} onChange={(e) => setD(Number(e.target.value))} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}

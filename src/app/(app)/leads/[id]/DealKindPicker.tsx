"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { DealKind } from "@prisma/client";
import { DEAL_KIND_META, listDealKinds } from "@/lib/pricing/deal-kinds";

/**
 * v2.15 — inline deal-kind editor on the Lead detail page.
 * Salesperson click-to-edit; PATCHes /api/leads/[id]. Drives PricingCard
 * form + onboarding template at handoff time.
 */
export function DealKindPicker({
  leadId,
  currentKind,
  canEdit,
}: {
  leadId: string;
  currentKind: DealKind;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const meta = DEAL_KIND_META[currentKind];

  async function setKind(kind: DealKind) {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealKind: kind }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed");
        return;
      }
      toast.success(`Deal kind changed to "${DEAL_KIND_META[kind].label}"`);
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2 text-xs text-gtn-grey-2">
        <span className="uppercase tracking-wide font-semibold">Deal kind:</span>
        <span className="text-gtn-navy font-medium">{meta.label}</span>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[10px] text-gtn-purple hover:underline"
          >
            change
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs flex-wrap">
      <span className="uppercase tracking-wide font-semibold text-gtn-grey-2">Deal kind:</span>
      <select
        value={currentKind}
        onChange={(e) => setKind(e.target.value as DealKind)}
        disabled={saving}
        className="h-7 rounded border border-input bg-white px-2 text-xs"
      >
        {listDealKinds().map((dk) => (
          <option key={dk.kind} value={dk.kind}>{dk.label}</option>
        ))}
      </select>
      {saving && <Loader2 className="h-3 w-3 animate-spin text-gtn-purple" />}
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={saving}
        className="text-[10px] text-gtn-grey-2 hover:text-gtn-navy"
      >
        cancel
      </button>
    </div>
  );
}

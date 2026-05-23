"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";

type Props = {
  leadId: string;
  initialServices: number;
  initialCustomer: number;
  initialDealQuality: number;
};

export function ScoreOverrideButton({
  leadId,
  initialServices,
  initialCustomer,
  initialDealQuality,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState(initialServices);
  const [customer, setCustomer] = useState(initialCustomer);
  const [dealQuality, setDealQuality] = useState(initialDealQuality);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/score-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          servicesScore: services,
          customerScore: customer,
          dealQualityScore: dealQuality,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed");
        return;
      }
      toast.success("Scores overridden");
      setOpen(false);
      setReason("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] uppercase tracking-wide text-white/80 hover:text-white underline"
      >
        Override
      </button>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-card max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gtn-navy mb-1">Override scores</h2>
            <p className="text-xs text-gtn-grey-2 mb-4">
              A note is required and the change is recorded in the audit log.
            </p>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Services</Label>
                  <Input type="number" min={0} max={100} value={services} onChange={(e) => setServices(Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Customer</Label>
                  <Input type="number" min={0} max={100} value={customer} onChange={(e) => setCustomer(Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Deal Quality</Label>
                  <Input type="number" min={0} max={100} value={dealQuality} onChange={(e) => setDealQuality(Number(e.target.value))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reason *</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving || !reason.trim()}>
                  {saving ? "Saving…" : "Apply override"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

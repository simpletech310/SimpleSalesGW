"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

type Lead = {
  id: string;
  businessName: string;
  industry: string;
  seatCount: number | null;
  siteCount: number;
  addressCity: string | null;
  addressState: string | null;
  primaryContactName: string | null;
  primaryContactTitle: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  executiveSponsorName: string | null;
  executiveSponsorTitle: string | null;
  dealQualityScore: number;
  servicesScore: number;
  customerScore: number;
  suggestedBundle: string | null;
  owner: { name: string; email: string };
  serviceMatches: Array<{ serviceLine: string; reasoning: string }>;
};

export function HandoffForm({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [scope, setScope] = useState(
    lead.serviceMatches.map((m) => `${m.serviceLine.replace(/_/g, " ")}: ${m.reasoning}`).join("\n"),
  );
  const [start, setStart] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const payload = useMemo(() => ({
    business: {
      name: lead.businessName,
      industry: lead.industry,
      seats: lead.seatCount,
      sites: lead.siteCount,
      city: lead.addressCity,
      state: lead.addressState,
    },
    contacts: {
      primary: {
        name: lead.primaryContactName,
        title: lead.primaryContactTitle,
        email: lead.primaryContactEmail,
        phone: lead.primaryContactPhone,
      },
      executiveSponsor: {
        name: lead.executiveSponsorName,
        title: lead.executiveSponsorTitle,
      },
    },
    scoring: {
      services: lead.servicesScore,
      customer: lead.customerScore,
      dealQuality: lead.dealQualityScore,
      suggestedBundle: lead.suggestedBundle,
    },
    scope: scope.split("\n").filter((l) => l.trim()),
    targetStart: start || null,
    salesperson: lead.owner,
    notes,
  }), [lead, scope, start, notes]);

  const payloadText = JSON.stringify(payload, null, 2);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, payload, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed");
      } else {
        toast.success("Handoff initiated. COO can now accept.");
        router.push(`/leads/${lead.id}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(payloadText);
    toast.success("Payload copied");
  }

  function printPage() { window.print(); }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Scope of work</h2>
        <Textarea rows={8} value={scope} onChange={(e) => setScope(e.target.value)} />
      </Card>
      <Card>
        <Label>Target start date</Label>
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-2" />
      </Card>
      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Notes to Ops</h2>
        <Textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Card>
      <Card>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gtn-navy">Copy-paste payload</h2>
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={copy}>Copy</Button>
            <Button variant="secondary" type="button" onClick={printPage}>Print</Button>
          </div>
        </div>
        <pre className="text-xs bg-gtn-lavender p-3 rounded overflow-x-auto max-h-72">{payloadText}</pre>
      </Card>
      <div className="flex justify-end">
        <Button onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Initiate handoff"}</Button>
      </div>
    </div>
  );
}

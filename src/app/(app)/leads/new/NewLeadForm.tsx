"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DealKind, Industry, LeadSource } from "@prisma/client";
import { DEAL_KIND_META, listDealKinds } from "@/lib/pricing/deal-kinds";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { FieldHelp } from "@/components/help/FieldHelp";
import { HELP } from "@/lib/help-copy";

const INDUSTRY_LABELS: Record<Industry, string> = {
  MEDICAL: "Medical / Healthcare",
  LEGAL: "Legal",
  FEDERAL_CONTRACTING: "Federal Contracting",
  MANUFACTURING: "Manufacturing",
  HOSPITALITY: "Hospitality",
  FINANCIAL_SERVICES: "Financial Services",
  PROFESSIONAL_SERVICES: "Professional Services",
  EDUCATION: "Education",
  NONPROFIT: "Nonprofit",
  OTHER: "Other",
};

export function NewLeadForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      businessName: fd.get("businessName"),
      industry: fd.get("industry"),
      seatCount: fd.get("seatCount") ? Number(fd.get("seatCount")) : undefined,
      siteCount: fd.get("siteCount") ? Number(fd.get("siteCount")) : 1,
      addressCity: fd.get("addressCity") || undefined,
      addressState: fd.get("addressState") || undefined,
      websiteUrl: fd.get("websiteUrl") || undefined,
      primaryContactName: fd.get("primaryContactName") || undefined,
      primaryContactTitle: fd.get("primaryContactTitle") || undefined,
      primaryContactEmail: fd.get("primaryContactEmail") || undefined,
      primaryContactPhone: fd.get("primaryContactPhone") || undefined,
      source: fd.get("source") || "INBOUND",
      dealKind: fd.get("dealKind") || DealKind.MANAGED_IT_BUNDLE,
      notes: fd.get("notes") || undefined,
    };
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to create lead");
        return;
      }
      toast.success("Lead created");
      router.push(`/leads/${data.lead.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* v2.15 — Deal-kind picker. Decides what PricingCard form to show + which
          onboarding tasks get seeded on handoff acceptance. */}
      <Card>
        <h2 className="text-lg font-semibold text-gtn-navy mb-2">What&apos;s this deal about?</h2>
        <p className="text-xs text-gtn-grey-2 mb-3">
          Pick the closest match. Drives pricing + post-handoff onboarding. You can change it later from the lead page.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {listDealKinds().map((dk) => (
            <label
              key={dk.kind}
              className="cursor-pointer rounded-md border border-gtn-lavender-2 p-3 hover:border-gtn-purple/40 has-[:checked]:border-gtn-purple has-[:checked]:bg-gtn-lavender/30 block"
            >
              <input
                type="radio"
                name="dealKind"
                value={dk.kind}
                defaultChecked={dk.kind === DEAL_KIND_META.MANAGED_IT_BUNDLE.kind}
                className="sr-only"
              />
              <p className="text-sm font-semibold text-gtn-navy">{dk.label}</p>
              <p className="text-xs text-gtn-grey-2 mt-0.5">{dk.tagline}</p>
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gtn-navy mb-4">Business</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="businessName">Business name *</Label>
            <Input id="businessName" name="businessName" required maxLength={200} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="industry">Industry *</Label>
              <FieldHelp>{HELP.lead.industry}</FieldHelp>
            </div>
            <select
              id="industry"
              name="industry"
              required
              defaultValue="OTHER"
              className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
            >
              {(Object.keys(INDUSTRY_LABELS) as Industry[]).map((k) => (
                <option key={k} value={k}>{INDUSTRY_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <select
              id="source"
              name="source"
              defaultValue={LeadSource.INBOUND}
              className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
            >
              {(Object.values(LeadSource) as LeadSource[]).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="seatCount">Seat count</Label>
              <FieldHelp>{HELP.lead.seatCount}</FieldHelp>
            </div>
            <Input id="seatCount" name="seatCount" type="number" min={0} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="siteCount">Sites</Label>
              <FieldHelp>{HELP.lead.siteCount}</FieldHelp>
            </div>
            <Input id="siteCount" name="siteCount" type="number" min={1} defaultValue={1} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressCity">City</Label>
            <Input id="addressCity" name="addressCity" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressState">State</Label>
            <Input id="addressState" name="addressState" maxLength={2} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="websiteUrl">Website</Label>
              <FieldHelp>{HELP.lead.websiteUrl}</FieldHelp>
            </div>
            <Input id="websiteUrl" name="websiteUrl" type="url" placeholder="https://" />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gtn-navy mb-4">Primary contact</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="primaryContactName">Name</Label>
            <Input id="primaryContactName" name="primaryContactName" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="primaryContactTitle">Title</Label>
            <Input id="primaryContactTitle" name="primaryContactTitle" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="primaryContactEmail">Email</Label>
            <Input id="primaryContactEmail" name="primaryContactEmail" type="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="primaryContactPhone">Phone</Label>
            <Input id="primaryContactPhone" name="primaryContactPhone" type="tel" />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gtn-navy mb-2">Optional pinned note</h2>
        <p className="text-sm text-gtn-grey-2 mb-3">Add any first-impression notes — pinned to the top of this lead.</p>
        <Textarea name="notes" placeholder="What did you hear in the first conversation?" />
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={saving} size="lg">
          {saving ? "Creating…" : "Create lead"}
        </Button>
      </div>
    </form>
  );
}

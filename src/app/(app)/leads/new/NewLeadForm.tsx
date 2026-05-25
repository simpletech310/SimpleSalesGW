"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DealKind, Industry, LeadSource, MspSatisfaction } from "@prisma/client";
import { DEAL_KIND_META, listDealKinds } from "@/lib/pricing/deal-kinds";
import {
  Server,
  Phone,
  Video,
  Cable,
  KeyRound,
  Camera,
  Layers3,
  Check,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { FormSection, FormField, FormActions } from "@/components/templates";
import { FieldHelp } from "@/components/help/FieldHelp";
import { HELP } from "@/lib/help-copy";
import { cn } from "@/lib/utils";

/**
 * v3.0.4 — Deal-kind picker now renders icon-led tiles instead of plain
 * bordered text cards. The icon makes each option scannable at a glance,
 * and a check pill in the corner of the selected tile gives clear
 * affordance for which is currently picked.
 */
const DEAL_KIND_ICONS: Record<DealKind, LucideIcon> = {
  MANAGED_IT_BUNDLE:          Server,
  VOICE_ONLY:                 Phone,
  VOICE_PLUS_VIDEO:           Video,
  STRUCTURED_CABLING_JOB:     Cable,
  ACCESS_CONTROL_PROJECT:     KeyRound,
  VIDEO_SURVEILLANCE_PROJECT: Camera,
  CUSTOM_MIX:                 Layers3,
};

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

const MSP_SATISFACTION_LABELS: Record<MspSatisfaction, string> = {
  NONE: "No current MSP / unsure",
  HAPPY: "Happy with current MSP",
  NEUTRAL: "Neutral — open to alternatives",
  LEAVING: "Actively leaving current MSP",
};

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink-strong " +
  "transition-colors duration-120 ease-smooth hover:border-line-strong " +
  "focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15";

export function NewLeadForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      // Business
      businessName: fd.get("businessName"),
      dbaName: nullableStr(fd.get("dbaName")),
      industry: fd.get("industry"),
      subindustry: nullableStr(fd.get("subindustry")),
      seatCount: fd.get("seatCount") ? Number(fd.get("seatCount")) : undefined,
      siteCount: fd.get("siteCount") ? Number(fd.get("siteCount")) : 1,
      source: fd.get("source") || "INBOUND",
      dealKind: fd.get("dealKind") || DealKind.MANAGED_IT_BUNDLE,

      // Address
      addressStreet: nullableStr(fd.get("addressStreet")),
      addressCity: nullableStr(fd.get("addressCity")),
      addressState: nullableStr(fd.get("addressState")),
      addressZip: nullableStr(fd.get("addressZip")),

      // Online presence
      websiteUrl: nullableStr(fd.get("websiteUrl")),
      linkedinCompanyUrl: nullableStr(fd.get("linkedinCompanyUrl")),
      googleBusinessUrl: nullableStr(fd.get("googleBusinessUrl")),

      // Primary contact
      primaryContactName: nullableStr(fd.get("primaryContactName")),
      primaryContactTitle: nullableStr(fd.get("primaryContactTitle")),
      primaryContactEmail: nullableStr(fd.get("primaryContactEmail")),
      primaryContactPhone: nullableStr(fd.get("primaryContactPhone")),

      // Executive sponsor
      executiveSponsorName: nullableStr(fd.get("executiveSponsorName")),
      executiveSponsorTitle: nullableStr(fd.get("executiveSponsorTitle")),

      // Current IT environment
      currentMspName: nullableStr(fd.get("currentMspName")),
      currentMspSatisfaction: fd.get("currentMspSatisfaction") || MspSatisfaction.NONE,

      // Notes
      notes: nullableStr(fd.get("notes")),
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
    <form onSubmit={onSubmit}>
      <div className="space-y-4 md:space-y-5 pb-24 md:pb-0">
        {/* Deal kind picker */}
        <FormSection
          title="What's this deal about?"
          subtitle="Pick the closest match. Drives pricing + post-handoff onboarding. You can change it later from the lead page."
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 md:col-span-2">
            {listDealKinds().map((dk) => {
              const Icon = DEAL_KIND_ICONS[dk.kind] ?? Layers3;
              return (
                <label
                  key={dk.kind}
                  className={cn(
                    "group relative cursor-pointer rounded-xl border border-line-subtle bg-surface p-4 block",
                    "transition-all duration-120 ease-smooth",
                    "hover:border-line-strong hover:shadow-card",
                    "has-[:checked]:border-brand has-[:checked]:bg-brand-soft/30",
                    "has-[:checked]:shadow-[0_2px_12px_rgba(91,79,207,0.12)]",
                  )}
                >
                  <input
                    type="radio"
                    name="dealKind"
                    value={dk.kind}
                    defaultChecked={dk.kind === DEAL_KIND_META.MANAGED_IT_BUNDLE.kind}
                    className="sr-only peer"
                  />
                  {/* Check pill in top-right when selected */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-2.5 right-2.5 inline-flex items-center justify-center w-5 h-5 rounded-full",
                      "bg-brand text-white opacity-0 scale-90 transition-all duration-150 ease-smooth",
                      "peer-checked:opacity-100 peer-checked:scale-100",
                    )}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "inline-flex items-center justify-center w-9 h-9 rounded-lg mb-2.5",
                      "bg-surface-3 text-ink-muted",
                      "transition-colors duration-120 ease-smooth",
                      "group-hover:bg-brand-soft group-hover:text-gtn-purple",
                      "peer-checked:bg-brand peer-checked:text-white",
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
                  </span>
                  <p className="text-sm font-semibold text-ink-strong leading-tight">{dk.label}</p>
                  <p className="text-xs text-ink-muted mt-1 leading-relaxed">{dk.tagline}</p>
                </label>
              );
            })}
          </div>
        </FormSection>

        {/* Business */}
        <FormSection title="Business" subtitle="Who is this lead and what do they do?" cols={2}>
          <FormField label="Business name" htmlFor="businessName" required full>
            <Input id="businessName" name="businessName" required maxLength={200} placeholder="Acme Manufacturing, Inc." />
          </FormField>
          <FormField label="DBA / trade name" htmlFor="dbaName" hint="Optional — only if different from legal name">
            <Input id="dbaName" name="dbaName" maxLength={200} placeholder="Acme" />
          </FormField>
          <FormField
            label={
              <span className="inline-flex items-center gap-1">
                Industry <FieldHelp>{HELP.lead.industry}</FieldHelp>
              </span>
            }
            htmlFor="industry"
            required
          >
            <select id="industry" name="industry" required defaultValue="OTHER" className={SELECT_CLASS}>
              {(Object.keys(INDUSTRY_LABELS) as Industry[]).map((k) => (
                <option key={k} value={k}>{INDUSTRY_LABELS[k]}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Sub-industry" htmlFor="subindustry" hint='Optional — e.g. "Orthopedic clinic", "Boutique law firm"'>
            <Input id="subindustry" name="subindustry" maxLength={200} />
          </FormField>
          <FormField label="Source" htmlFor="source">
            <select id="source" name="source" defaultValue={LeadSource.INBOUND} className={SELECT_CLASS}>
              {(Object.values(LeadSource) as LeadSource[]).map((v) => (
                <option key={v} value={v}>{v.replace(/_/g, " ")}</option>
              ))}
            </select>
          </FormField>
          <FormField
            label={
              <span className="inline-flex items-center gap-1">
                Seat count <FieldHelp>{HELP.lead.seatCount}</FieldHelp>
              </span>
            }
            htmlFor="seatCount"
            hint="Pricing won't show until we know this"
          >
            <Input id="seatCount" name="seatCount" type="number" min={0} placeholder="e.g. 25" />
          </FormField>
          <FormField
            label={
              <span className="inline-flex items-center gap-1">
                Sites <FieldHelp>{HELP.lead.siteCount}</FieldHelp>
              </span>
            }
            htmlFor="siteCount"
          >
            <Input id="siteCount" name="siteCount" type="number" min={1} defaultValue={1} />
          </FormField>
        </FormSection>

        {/* Address */}
        <FormSection
          title="Address"
          subtitle="Geocoded automatically to drop a pin on the leads map and auto-match a sales territory."
          cols={2}
        >
          <FormField label="Street" htmlFor="addressStreet" full>
            <Input id="addressStreet" name="addressStreet" maxLength={200} placeholder="123 Main St" />
          </FormField>
          <FormField label="City" htmlFor="addressCity">
            <Input id="addressCity" name="addressCity" maxLength={100} placeholder="Lake Elsinore" />
          </FormField>
          <FormField label="State" htmlFor="addressState">
            <Input id="addressState" name="addressState" maxLength={2} placeholder="CA" className="uppercase" />
          </FormField>
          <FormField label="Zip" htmlFor="addressZip">
            <Input id="addressZip" name="addressZip" maxLength={10} placeholder="92530" />
          </FormField>
        </FormSection>

        {/* Online presence */}
        <FormSection title="Online presence" subtitle="Feeds the AI research summary and pre-call brief." cols={2}>
          <FormField
            label={
              <span className="inline-flex items-center gap-1">
                Website <FieldHelp>{HELP.lead.websiteUrl}</FieldHelp>
              </span>
            }
            htmlFor="websiteUrl"
            full
          >
            <Input id="websiteUrl" name="websiteUrl" type="url" placeholder="https://" />
          </FormField>
          <FormField label="LinkedIn company URL" htmlFor="linkedinCompanyUrl">
            <Input
              id="linkedinCompanyUrl"
              name="linkedinCompanyUrl"
              type="url"
              placeholder="https://www.linkedin.com/company/…"
            />
          </FormField>
          <FormField label="Google Business profile" htmlFor="googleBusinessUrl">
            <Input id="googleBusinessUrl" name="googleBusinessUrl" type="url" placeholder="https://…" />
          </FormField>
        </FormSection>

        {/* Primary contact */}
        <FormSection title="Primary contact" subtitle="Who you actually talk to. Day-to-day operator, not necessarily the decision-maker." cols={2}>
          <FormField label="Name" htmlFor="primaryContactName">
            <Input id="primaryContactName" name="primaryContactName" maxLength={200} />
          </FormField>
          <FormField label="Title" htmlFor="primaryContactTitle">
            <Input id="primaryContactTitle" name="primaryContactTitle" maxLength={200} placeholder="Office Manager" />
          </FormField>
          <FormField label="Email" htmlFor="primaryContactEmail">
            <Input id="primaryContactEmail" name="primaryContactEmail" type="email" />
          </FormField>
          <FormField label="Phone" htmlFor="primaryContactPhone">
            <Input id="primaryContactPhone" name="primaryContactPhone" type="tel" placeholder="(555) 555-5555" />
          </FormField>
        </FormSection>

        {/* Executive sponsor */}
        <FormSection
          title="Executive sponsor"
          subtitle="The person who actually signs the deal — often different from the primary contact. Knowing the sponsor early speeds up close."
          cols={2}
        >
          <FormField label="Name" htmlFor="executiveSponsorName">
            <Input id="executiveSponsorName" name="executiveSponsorName" maxLength={200} />
          </FormField>
          <FormField label="Title" htmlFor="executiveSponsorTitle">
            <Input id="executiveSponsorTitle" name="executiveSponsorTitle" maxLength={200} placeholder="CEO / Owner" />
          </FormField>
        </FormSection>

        {/* Current IT environment */}
        <FormSection
          title="Current IT environment"
          subtitle="What's in place today. Drives the discovery script and identifies displacement opportunities."
          cols={2}
        >
          <FormField label="Current MSP / IT provider" htmlFor="currentMspName" hint="Leave blank if none / in-house">
            <Input id="currentMspName" name="currentMspName" maxLength={200} placeholder="Acme IT" />
          </FormField>
          <FormField label="Satisfaction" htmlFor="currentMspSatisfaction">
            <select
              id="currentMspSatisfaction"
              name="currentMspSatisfaction"
              defaultValue={MspSatisfaction.NONE}
              className={SELECT_CLASS}
            >
              {(Object.keys(MSP_SATISFACTION_LABELS) as MspSatisfaction[]).map((k) => (
                <option key={k} value={k}>{MSP_SATISFACTION_LABELS[k]}</option>
              ))}
            </select>
          </FormField>
        </FormSection>

        {/* Notes */}
        <FormSection
          title="First-impression note"
          subtitle="Optional. Anything you heard in the first conversation that's worth pinning to the top of this lead."
        >
          <div className="md:col-span-2">
            <Textarea name="notes" placeholder="They mentioned their phones drop calls during peak hours and they're frustrated with their current MSP's response time…" />
          </div>
        </FormSection>
      </div>

      {/* Sticky action footer */}
      <div className="sticky bottom-0 md:static inset-x-0 z-10 mt-5 -mx-4 md:mx-0 px-4 md:px-0">
        <div className="rounded-t-xl md:rounded-xl bg-surface border border-line-subtle px-4 md:px-5 py-3 flex items-center justify-end gap-2 shadow-pop md:shadow-card">
          <FormActions cancelHref="/leads" submitLabel={saving ? "Creating…" : "Create lead"} busy={saving} />
        </div>
      </div>
    </form>
  );
}

function nullableStr(v: FormDataEntryValue | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length === 0 ? undefined : s;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Industry, LeadSource, MspSatisfaction } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

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

type LeadShape = {
  id: string;
  businessName: string;
  industry: Industry;
  source: LeadSource;
  seatCount: number | null;
  siteCount: number;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  websiteUrl: string | null;
  linkedinCompanyUrl: string | null;
  googleBusinessUrl: string | null;
  primaryContactName: string | null;
  primaryContactTitle: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  executiveSponsorName: string | null;
  executiveSponsorTitle: string | null;
  currentMspName: string | null;
  currentMspSatisfaction: MspSatisfaction;
  // v3.3.28 — OSINT-discovered fields. All optional; the rep can correct
  // anything the agent got wrong.
  foundedYear: number | null;
  estimatedAnnualRevenue: string | null;
  employeeCountBand: string | null;
  registeredEntityType: string | null;
  techStackHints: string[];
  emailProvider: string | null;
  websiteCms: string | null;
  publicCertifications: string[];
  socialFacebookUrl: string | null;
  socialTwitterUrl: string | null;
  socialYoutubeUrl: string | null;
  pressContactEmail: string | null;
};

/**
 * v2.23.3 — Edit form for an existing lead. Mirrors the v2.13 NewLeadForm
 * but seeded with current values and PATCHing instead of POSTing. After
 * save, if address fields changed, the existing PATCH handler fires the
 * geocode + territory match so the lead appears on the map.
 */
export function EditLeadForm({ lead }: { lead: LeadShape }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      businessName: fd.get("businessName"),
      industry: fd.get("industry"),
      source: fd.get("source"),
      seatCount: fd.get("seatCount") ? Number(fd.get("seatCount")) : null,
      siteCount: fd.get("siteCount") ? Number(fd.get("siteCount")) : 1,
      addressStreet: nullableStr(fd.get("addressStreet")),
      addressCity: nullableStr(fd.get("addressCity")),
      addressState: nullableStr(fd.get("addressState")),
      addressZip: nullableStr(fd.get("addressZip")),
      websiteUrl: nullableStr(fd.get("websiteUrl")),
      linkedinCompanyUrl: nullableStr(fd.get("linkedinCompanyUrl")),
      googleBusinessUrl: nullableStr(fd.get("googleBusinessUrl")),
      primaryContactName: nullableStr(fd.get("primaryContactName")),
      primaryContactTitle: nullableStr(fd.get("primaryContactTitle")),
      primaryContactEmail: nullableStr(fd.get("primaryContactEmail")),
      primaryContactPhone: nullableStr(fd.get("primaryContactPhone")),
      executiveSponsorName: nullableStr(fd.get("executiveSponsorName")),
      executiveSponsorTitle: nullableStr(fd.get("executiveSponsorTitle")),
      currentMspName: nullableStr(fd.get("currentMspName")),
      currentMspSatisfaction: fd.get("currentMspSatisfaction"),
      // v3.3.28 — OSINT enrichment fields (all optional)
      foundedYear: fd.get("foundedYear") ? Number(fd.get("foundedYear")) : null,
      estimatedAnnualRevenue: nullableStr(fd.get("estimatedAnnualRevenue")),
      employeeCountBand: nullableStr(fd.get("employeeCountBand")),
      registeredEntityType: nullableStr(fd.get("registeredEntityType")),
      techStackHints: csvToArray(fd.get("techStackHints")),
      emailProvider: nullableStr(fd.get("emailProvider")),
      websiteCms: nullableStr(fd.get("websiteCms")),
      publicCertifications: csvToArray(fd.get("publicCertifications")),
      socialFacebookUrl: nullableStr(fd.get("socialFacebookUrl")),
      socialTwitterUrl: nullableStr(fd.get("socialTwitterUrl")),
      socialYoutubeUrl: nullableStr(fd.get("socialYoutubeUrl")),
      pressContactEmail: nullableStr(fd.get("pressContactEmail")),
    };
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Save failed");
        return;
      }
      toast.success("Lead updated");
      router.push(`/leads/${lead.id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <h2 className="text-lg font-semibold text-gtn-navy mb-4">Business</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="businessName">Business name *</Label>
            <Input id="businessName" name="businessName" required maxLength={200} defaultValue={lead.businessName} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry *</Label>
            <select
              id="industry"
              name="industry"
              required
              defaultValue={lead.industry}
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
              defaultValue={lead.source}
              className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
            >
              {(Object.values(LeadSource) as LeadSource[]).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="seatCount">Seat count</Label>
            <Input id="seatCount" name="seatCount" type="number" min={0} defaultValue={lead.seatCount ?? undefined} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="siteCount">Sites</Label>
            <Input id="siteCount" name="siteCount" type="number" min={1} defaultValue={lead.siteCount} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gtn-navy mb-1">Address</h2>
        <p className="text-xs text-gtn-grey-2 mb-3">
          City + state — or just a zip — is enough for the lead to land on the map.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="addressStreet">Street</Label>
            <Input id="addressStreet" name="addressStreet" defaultValue={lead.addressStreet ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressCity">City</Label>
            <Input id="addressCity" name="addressCity" defaultValue={lead.addressCity ?? ""} placeholder="Burbank" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="addressState">State</Label>
              <Input id="addressState" name="addressState" maxLength={2} defaultValue={lead.addressState ?? ""} placeholder="CA" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressZip">Zip</Label>
              <Input id="addressZip" name="addressZip" maxLength={10} defaultValue={lead.addressZip ?? ""} placeholder="91501" />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gtn-navy mb-4">Web presence</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="websiteUrl">Website</Label>
            <Input id="websiteUrl" name="websiteUrl" type="url" placeholder="https://" defaultValue={lead.websiteUrl ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="linkedinCompanyUrl">LinkedIn URL (manual reference)</Label>
            <Input id="linkedinCompanyUrl" name="linkedinCompanyUrl" type="url" placeholder="https://www.linkedin.com/company/…" defaultValue={lead.linkedinCompanyUrl ?? ""} />
            <p className="text-xs text-gtn-grey-2">
              Stored as a reference for the rep — not auto-scraped. LinkedIn blocks server-side fetches.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="googleBusinessUrl">Google Business URL</Label>
            <Input id="googleBusinessUrl" name="googleBusinessUrl" type="url" defaultValue={lead.googleBusinessUrl ?? ""} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gtn-navy mb-4">Primary contact</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="primaryContactName">Name</Label>
            <Input id="primaryContactName" name="primaryContactName" defaultValue={lead.primaryContactName ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="primaryContactTitle">Title</Label>
            <Input id="primaryContactTitle" name="primaryContactTitle" defaultValue={lead.primaryContactTitle ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="primaryContactEmail">Email</Label>
            <Input id="primaryContactEmail" name="primaryContactEmail" type="email" defaultValue={lead.primaryContactEmail ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="primaryContactPhone">Phone</Label>
            <Input id="primaryContactPhone" name="primaryContactPhone" type="tel" defaultValue={lead.primaryContactPhone ?? ""} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gtn-navy mb-4">Executive sponsor + current MSP</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="executiveSponsorName">Executive sponsor</Label>
            <Input id="executiveSponsorName" name="executiveSponsorName" defaultValue={lead.executiveSponsorName ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="executiveSponsorTitle">Sponsor title</Label>
            <Input id="executiveSponsorTitle" name="executiveSponsorTitle" defaultValue={lead.executiveSponsorTitle ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currentMspName">Current MSP</Label>
            <Input id="currentMspName" name="currentMspName" defaultValue={lead.currentMspName ?? ""} placeholder="If none, leave blank" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currentMspSatisfaction">MSP satisfaction</Label>
            <select
              id="currentMspSatisfaction"
              name="currentMspSatisfaction"
              defaultValue={lead.currentMspSatisfaction}
              className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
            >
              {(Object.values(MspSatisfaction) as MspSatisfaction[]).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* v3.3.28 — Auto-discovered enrichment fields. Rendered with an
          `id="enrichment"` anchor so the Overview-tab "Edit" link drops
          the rep directly here. Every field is optional. The agent
          populates them; the rep corrects anything wrong. Arrays accept
          comma-separated input. Offices, keyContacts, recentNews, and
          charterIdentifiers (which need richer editors) are managed via
          the agent + read-only Overview card today; a structured
          editor for those lands in a follow-up. */}
      <Card id="enrichment">
        <h2 className="text-lg font-semibold text-gtn-navy mb-1">Auto-discovered intel</h2>
        <p className="text-xs text-gtn-grey-2 mb-3">
          Populated by Gateway AI research. All optional — correct anything wrong, or leave blank.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="foundedYear">Founded year</Label>
            <Input
              id="foundedYear"
              name="foundedYear"
              type="number"
              min={1700}
              max={2100}
              defaultValue={lead.foundedYear ?? undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="registeredEntityType">Entity type</Label>
            <Input
              id="registeredEntityType"
              name="registeredEntityType"
              maxLength={80}
              placeholder="LLC, S-Corp, 501c3, Credit Union…"
              defaultValue={lead.registeredEntityType ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="estimatedAnnualRevenue">Est. annual revenue / assets</Label>
            <Input
              id="estimatedAnnualRevenue"
              name="estimatedAnnualRevenue"
              maxLength={40}
              placeholder="$1M-$5M, $25M-$100M, etc."
              defaultValue={lead.estimatedAnnualRevenue ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employeeCountBand">Employee count (band)</Label>
            <Input
              id="employeeCountBand"
              name="employeeCountBand"
              maxLength={40}
              placeholder="10-50, 100-250, etc."
              defaultValue={lead.employeeCountBand ?? ""}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="techStackHints">Tech stack hints (comma-separated)</Label>
            <Input
              id="techStackHints"
              name="techStackHints"
              placeholder="Microsoft 365, Cloudflare, WordPress"
              defaultValue={lead.techStackHints?.join(", ") ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emailProvider">Email provider</Label>
            <Input
              id="emailProvider"
              name="emailProvider"
              maxLength={80}
              placeholder="Google Workspace, Microsoft 365…"
              defaultValue={lead.emailProvider ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="websiteCms">Website CMS</Label>
            <Input
              id="websiteCms"
              name="websiteCms"
              maxLength={80}
              placeholder="WordPress, Wix, Webflow…"
              defaultValue={lead.websiteCms ?? ""}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="publicCertifications">Publicly claimed certifications (comma-separated)</Label>
            <Input
              id="publicCertifications"
              name="publicCertifications"
              placeholder="SOC 2, HIPAA, PCI DSS, ISO 27001"
              defaultValue={lead.publicCertifications?.join(", ") ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="socialFacebookUrl">Facebook URL</Label>
            <Input
              id="socialFacebookUrl"
              name="socialFacebookUrl"
              type="url"
              defaultValue={lead.socialFacebookUrl ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="socialTwitterUrl">X / Twitter URL</Label>
            <Input
              id="socialTwitterUrl"
              name="socialTwitterUrl"
              type="url"
              defaultValue={lead.socialTwitterUrl ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="socialYoutubeUrl">YouTube URL</Label>
            <Input
              id="socialYoutubeUrl"
              name="socialYoutubeUrl"
              type="url"
              defaultValue={lead.socialYoutubeUrl ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pressContactEmail">Press contact email</Label>
            <Input
              id="pressContactEmail"
              name="pressContactEmail"
              type="email"
              defaultValue={lead.pressContactEmail ?? ""}
            />
          </div>
        </div>
        <p className="text-xs text-gtn-grey-2 mt-3">
          Offices, decision-makers, and recent-news entries are managed by the AI agent on
          the Research tab — view them on the Overview tab&apos;s &quot;Enriched intel&quot; card.
        </p>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push(`/leads/${lead.id}`)} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} size="lg">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function nullableStr(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/** Parse a comma-separated input into a deduplicated, trimmed string array.
 *  Returns [] when blank — the zod schema treats that as "no change" and
 *  the PATCH route's non-null logic preserves any existing value. */
function csvToArray(v: FormDataEntryValue | null): string[] {
  if (v == null) return [];
  return String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s, i, arr) => arr.indexOf(s) === i);
}

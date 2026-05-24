"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Industry, ServiceLine } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";
import {
  type MspProfile,
  type ServiceEmphasis,
  type ServiceLineProfile,
  type WinStory,
} from "@/lib/msp/profile";
import { renderMspProfileBlock } from "@/lib/msp/promptBlock";

/**
 * v2.21 — MSP profile editor.
 *
 * Mirrors the form-based pattern in PricingEditor (sticky toolbar,
 * dirty-state tracking, tabbed sections, Reset + Save). Each tab edits
 * a slice of the MspProfile; the Preview tab renders the assembled
 * prompt block so the admin sees exactly what Claude will see.
 */

const ALL_SERVICE_LINES: ServiceLine[] = [
  ServiceLine.MANAGED_IT,
  ServiceLine.CYBERSECURITY,
  ServiceLine.NIST_ASSESSMENT,
  ServiceLine.AI_ADVISORY,
  ServiceLine.VCIO_RETAINER,
  ServiceLine.VOIP,
  ServiceLine.CABLING,
  ServiceLine.ACCESS_CONTROL,
  ServiceLine.VIDEO,
];

const ALL_INDUSTRIES: Array<Industry | "ANY"> = [
  "ANY",
  Industry.MEDICAL,
  Industry.LEGAL,
  Industry.FEDERAL_CONTRACTING,
  Industry.MANUFACTURING,
  Industry.HOSPITALITY,
  Industry.FINANCIAL_SERVICES,
  Industry.PROFESSIONAL_SERVICES,
  Industry.EDUCATION,
  Industry.NONPROFIT,
  Industry.OTHER,
];

type Tab = "identity" | "services" | "markets" | "wins" | "preview" | "advanced";

const EMPHASIS_OPTIONS: ServiceEmphasis[] = ["focus", "normal", "de-emphasize"];

export function MspProfileEditor({
  initialProfile,
  defaultProfile,
}: {
  initialProfile: MspProfile;
  defaultProfile: MspProfile;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("identity");
  const [profile, setProfile] = useState<MspProfile>(() => normalizeServices(initialProfile));
  const [rawText, setRawText] = useState<string>(() => JSON.stringify(initialProfile, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function markDirty() {
    setDirty(true);
  }

  function patch<K extends keyof MspProfile>(key: K, value: MspProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
    markDirty();
  }

  function switchTab(next: Tab) {
    if (tab === "advanced" && next !== "advanced") {
      try {
        const parsed = JSON.parse(rawText) as MspProfile;
        setProfile(normalizeServices(parsed));
        setParseError(null);
      } catch (err) {
        setParseError((err as Error).message);
        toast.error("JSON has errors — fix them or use Reset before leaving Advanced.");
        return;
      }
    }
    if (tab !== "advanced" && next === "advanced") {
      setRawText(JSON.stringify(profile, null, 2));
    }
    setTab(next);
  }

  async function save() {
    setSaving(true);
    try {
      let payload = profile;
      if (tab === "advanced") {
        try {
          payload = JSON.parse(rawText) as MspProfile;
        } catch (err) {
          setParseError((err as Error).message);
          toast.error("Fix JSON syntax first.");
          return;
        }
      }
      const res = await fetch("/api/admin/msp-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        // v2.20.1 pattern — surface the first Zod field error so the
        // admin sees what's actually wrong.
        const flatten = data?.details as
          | { fieldErrors?: Record<string, string[]>; formErrors?: string[] }
          | undefined;
        const firstFieldError = flatten?.fieldErrors
          ? Object.entries(flatten.fieldErrors).find(([, msgs]) => msgs?.length)
          : undefined;
        const detail = firstFieldError
          ? `${firstFieldError[0]}: ${firstFieldError[1][0]}`
          : flatten?.formErrors?.[0];
        toast.error(detail ? `${data.error}: ${detail}` : (data?.error ?? "Save failed"), {
          duration: 8000,
        });
        return;
      }
      toast.success("MSP profile saved — applies to next AI call");
      setProfile(normalizeServices(payload));
      setRawText(JSON.stringify(payload, null, 2));
      setDirty(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function resetToDefaults() {
    if (!confirm("Replace the editor with the committed defaults? (Not saved until you click Save.)")) return;
    setProfile(normalizeServices(defaultProfile));
    setRawText(JSON.stringify(defaultProfile, null, 2));
    setParseError(null);
    markDirty();
  }

  // Live preview re-renders on every keystroke. Cheap — pure string
  // assembly of the in-memory profile.
  const preview = useMemo(() => renderMspProfileBlock(profile), [profile]);

  return (
    <div className="space-y-4">
      {/* Sticky toolbar — mirrors PricingEditor */}
      <Card className="sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gtn-navy">Edit MSP profile</h2>
            <p className="text-xs text-gtn-grey-2 mt-0.5">
              Saved to <code className="gtn-code-pill">SystemConfig.msp.profile</code>.
              Version: <code className="gtn-code-pill">{profile.version}</code>.
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
          { key: "identity", label: "Identity" },
          { key: "services", label: "Services", count: profile.services.length },
          { key: "markets", label: "Markets & positioning" },
          { key: "wins", label: "Win stories", count: profile.winStories.length },
          { key: "preview", label: "Preview" },
          { key: "advanced", label: "Advanced JSON" },
        ] as Array<{ key: Tab; label: string; count?: number }>).map((t) => (
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

      {tab === "identity" && <IdentityTab profile={profile} patch={patch} />}
      {tab === "services" && <ServicesTab profile={profile} patch={patch} />}
      {tab === "markets" && <MarketsTab profile={profile} patch={patch} />}
      {tab === "wins" && <WinStoriesTab profile={profile} patch={patch} />}

      {tab === "preview" && (
        <Card>
          <h3 className="text-sm font-semibold text-gtn-navy mb-1">What Claude will see</h3>
          <p className="text-xs text-gtn-grey-2 mb-3">
            Live preview of the system-prompt preamble prepended to every Claude call.
            Re-renders on every change.
          </p>
          <pre className="w-full font-mono text-xs whitespace-pre-wrap rounded-md border border-input bg-gtn-lavender/30 px-3 py-2 max-h-[600px] overflow-y-auto">
            {preview}
          </pre>
        </Card>
      )}

      {tab === "advanced" && (
        <Card>
          <div className="flex items-start justify-between mb-2 gap-2 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-gtn-navy">Raw JSON editor</h3>
              <p className="text-xs text-gtn-grey-2 mt-0.5">
                For bulk edits or pasting a known-good profile from a backup. Form-tab
                changes are merged in when you switch back.
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

// Make sure every ServiceLine enum value has a row; missing ones get
// added with `normal` emphasis so admin can see + edit them.
function normalizeServices(p: MspProfile): MspProfile {
  const present = new Set(p.services.map((s) => s.serviceLine));
  const missing: ServiceLineProfile[] = ALL_SERVICE_LINES
    .filter((sl) => !present.has(sl))
    .map((sl) => ({ serviceLine: sl, emphasis: "normal" }));
  return { ...p, services: [...p.services, ...missing] };
}

// ---------------------------------------------------------------------------
// Identity tab
// ---------------------------------------------------------------------------

function IdentityTab({
  profile,
  patch,
}: {
  profile: MspProfile;
  patch: <K extends keyof MspProfile>(key: K, value: MspProfile[K]) => void;
}) {
  return (
    <Card>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="companyName">Company name *</Label>
          <Input id="companyName" value={profile.companyName} onChange={(e) => patch("companyName", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="location">Headquarters location *</Label>
          <Input id="location" value={profile.location} onChange={(e) => patch("location", e.target.value)} placeholder="Burbank, CA" />
        </div>
      </div>

      <div className="space-y-1 mt-3">
        <Label htmlFor="tagline">Tagline</Label>
        <Input
          id="tagline"
          value={profile.tagline}
          onChange={(e) => patch("tagline", e.target.value)}
          placeholder="a Southern-California managed-services provider"
        />
      </div>

      <div className="space-y-1 mt-3">
        <Label htmlFor="missionStatement">Mission statement</Label>
        <Textarea
          id="missionStatement"
          rows={2}
          value={profile.missionStatement}
          onChange={(e) => patch("missionStatement", e.target.value)}
          placeholder="One-sentence statement of what the company exists to do for customers."
        />
      </div>

      <div className="space-y-1 mt-3">
        <Label htmlFor="brandVoice">Brand voice / tone</Label>
        <Textarea
          id="brandVoice"
          rows={3}
          value={profile.brandVoice}
          onChange={(e) => patch("brandVoice", e.target.value)}
          placeholder="Warm + direct, no fluff, no MBA-speak. Specific over generic."
        />
        <p className="text-[11px] text-gtn-grey-3 mt-1">
          Claude reads this as style rules for every output. Be specific — list do&apos;s and don&apos;ts.
        </p>
      </div>

      <div className="space-y-1 mt-3">
        <Label htmlFor="background">Company background</Label>
        <Textarea
          id="background"
          rows={4}
          value={profile.background}
          onChange={(e) => patch("background", e.target.value)}
          placeholder="A few sentences about the company's history, focus, and what makes the team distinctive."
        />
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Services tab
// ---------------------------------------------------------------------------

function ServicesTab({
  profile,
  patch,
}: {
  profile: MspProfile;
  patch: <K extends keyof MspProfile>(key: K, value: MspProfile[K]) => void;
}) {
  function updateService(i: number, p: Partial<ServiceLineProfile>) {
    const next = profile.services.map((s, idx) => (idx === i ? { ...s, ...p } : s));
    patch("services", next);
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gtn-navy mb-1">Services emphasis</h3>
      <p className="text-xs text-gtn-grey-2 mb-4">
        Tag each service. <strong>[focus]</strong> services get pushed by the AI when
        they fit; <strong>[de-emphasize]</strong> services are not proposed unless the
        customer explicitly asks. Optional note (200 chars) gives the AI context — e.g.
        &ldquo;Q2 push: new bundle&rdquo; or &ldquo;Capacity-constrained, only sell to existing
        accounts&rdquo;.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-left text-xs uppercase tracking-wide text-gtn-grey-2 border-b border-gtn-lavender-2">
            <tr>
              <th className="py-2 pr-3 font-medium w-48">Service line</th>
              <th className="py-2 pr-3 font-medium w-40">Emphasis</th>
              <th className="py-2 font-medium">Note (optional)</th>
            </tr>
          </thead>
          <tbody>
            {profile.services.map((s, i) => (
              <tr key={s.serviceLine} className="border-b border-gtn-lavender-2 last:border-0">
                <td className="py-2 pr-3 font-medium text-gtn-navy">{s.serviceLine.replace(/_/g, " ")}</td>
                <td className="py-2 pr-3">
                  <select
                    value={s.emphasis}
                    onChange={(e) => updateService(i, { emphasis: e.target.value as ServiceEmphasis })}
                    className="h-9 w-full rounded-md border border-input bg-white px-2 text-sm"
                  >
                    {EMPHASIS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td className="py-2">
                  <Input
                    value={s.note ?? ""}
                    onChange={(e) => updateService(i, { note: e.target.value || undefined })}
                    placeholder='e.g. "Q2 push — new MSP-XDR bundle"'
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Markets & positioning tab
// ---------------------------------------------------------------------------

function MarketsTab({
  profile,
  patch,
}: {
  profile: MspProfile;
  patch: <K extends keyof MspProfile>(key: K, value: MspProfile[K]) => void;
}) {
  return (
    <div className="space-y-3">
      <StringListEditor
        label="Target markets (verticals)"
        helpText="Industries the company actively pursues. Claude uses this to identify fit signals."
        placeholder="Medical"
        values={profile.targetMarkets}
        onChange={(next) => patch("targetMarkets", next)}
      />
      <StringListEditor
        label="Differentiators (why customers pick us)"
        helpText="Short phrases — the AI cites these in proposals and outreach."
        placeholder="Built-in NIST/CMMC pre-audit at every renewal"
        values={profile.differentiators}
        onChange={(next) => patch("differentiators", next)}
      />
      <StringListEditor
        label="Out of scope (do NOT propose)"
        helpText="Claude won't suggest these services — and Handoff QC flags handoffs that promise them."
        placeholder="Consumer / residential support"
        values={profile.outOfScope}
        onChange={(next) => patch("outOfScope", next)}
      />
    </div>
  );
}

function StringListEditor({
  label,
  helpText,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  helpText: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  function update(i: number, value: string) {
    onChange(values.map((v, idx) => (idx === i ? value : v)));
  }
  function add() {
    onChange([...values, ""]);
  }
  function remove(i: number) {
    onChange(values.filter((_, idx) => idx !== i));
  }
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gtn-navy">{label}</h3>
          <p className="text-xs text-gtn-grey-2 mt-0.5">{helpText}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>
      {values.length === 0 ? (
        <p className="text-xs text-gtn-grey-2 italic mt-3">No entries yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {values.map((v, i) => (
            <li key={i} className="flex items-center gap-2">
              <Input
                value={v}
                onChange={(e) => update(i, e.target.value)}
                placeholder={placeholder}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-gtn-grey-2 hover:text-gtn-red"
                aria-label="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Win stories tab
// ---------------------------------------------------------------------------

function WinStoriesTab({
  profile,
  patch,
}: {
  profile: MspProfile;
  patch: <K extends keyof MspProfile>(key: K, value: MspProfile[K]) => void;
}) {
  function update(i: number, p: Partial<WinStory>) {
    patch("winStories", profile.winStories.map((w, idx) => (idx === i ? { ...w, ...p } : w)));
  }
  function add() {
    patch("winStories", [...profile.winStories, { industry: "ANY" as const, situation: "", outcome: "" }]);
  }
  function remove(i: number) {
    patch("winStories", profile.winStories.filter((_, idx) => idx !== i));
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gtn-navy">Real wins we can cite</h3>
          <p className="text-xs text-gtn-grey-2 mt-0.5 max-w-2xl">
            Anonymized customer wins the AI uses to ground objection rebuttals and
            outreach (&ldquo;we work with N other 50-seat medical practices&hellip;&rdquo;). Keep
            names out — use industry + size descriptors.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add win story
        </Button>
      </div>
      {profile.winStories.length === 0 ? (
        <p className="text-xs text-gtn-grey-2 italic">
          No win stories yet. Add a few to dramatically improve objection-coach output.
        </p>
      ) : (
        <ul className="space-y-3">
          {profile.winStories.map((w, i) => (
            <li key={i} className="border border-gtn-lavender-2 rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Industry</Label>
                  <select
                    value={w.industry}
                    onChange={(e) => update(i, { industry: e.target.value as Industry | "ANY" })}
                    className="h-8 rounded border border-input bg-white px-2 text-xs"
                  >
                    {ALL_INDUSTRIES.map((ind) => (
                      <option key={ind} value={ind}>{ind === "ANY" ? "Any" : ind.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-gtn-grey-2 hover:text-gtn-red"
                  aria-label="Remove win story"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Situation (anonymized)</Label>
                <Textarea
                  rows={2}
                  value={w.situation}
                  onChange={(e) => update(i, { situation: e.target.value })}
                  placeholder="50-seat medical practice on Comcast + ad-hoc help-desk, no compliance work"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Outcome (measurable)</Label>
                <Textarea
                  rows={2}
                  value={w.outcome}
                  onChange={(e) => update(i, { outcome: e.target.value })}
                  placeholder="Migrated to managed IT + NIST in 8 weeks, eliminated 2 incidents/mo, passed cyber-insurance audit"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

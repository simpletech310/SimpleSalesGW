"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Industry, ServiceLine } from "@prisma/client";
import { Button } from "@/components/ui/Button";
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
      <div className="sticky top-0 z-10 rounded-xl bg-surface border border-line-subtle p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink-strong">Edit MSP profile</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Saved to <code className="font-mono text-[10px] bg-surface-2 px-1.5 py-0.5 rounded text-ink-strong">SystemConfig.msp.profile</code>.
              Version: <code className="font-mono text-[10px] bg-surface-2 px-1.5 py-0.5 rounded text-ink-strong">{profile.version}</code>.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={resetToDefaults}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset to defaults
            </Button>
            <Button onClick={save} disabled={saving || (!dirty && tab !== "advanced")} size="sm">
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              {saving ? "Saving…" : dirty ? "Save changes" : "Save"}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-line-subtle">
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
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors duration-120 ${
              tab === t.key
                ? "border-gtn-purple text-ink-strong"
                : "border-transparent text-ink-muted hover:text-ink-strong"
            }`}
          >
            {t.label}
            {t.count != null && (
              <span className="ml-1.5 text-[11px] text-ink-faint font-mono tabular">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "identity" && <IdentityTab profile={profile} patch={patch} />}
      {tab === "services" && <ServicesTab profile={profile} patch={patch} />}
      {tab === "markets" && <MarketsTab profile={profile} patch={patch} />}
      {tab === "wins" && <WinStoriesTab profile={profile} patch={patch} />}

      {tab === "preview" && (
        <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
          <h3 className="text-sm font-semibold text-ink-strong mb-1">What Claude will see</h3>
          <p className="text-xs text-ink-muted mb-3">
            Live preview of the system-prompt preamble prepended to every Claude call.
            Re-renders on every change.
          </p>
          <pre className="w-full font-mono text-xs whitespace-pre-wrap rounded-md border border-line-subtle bg-surface-2 px-4 py-3 max-h-[600px] overflow-y-auto text-ink-strong leading-relaxed">
            {preview}
          </pre>
        </div>
      )}

      {tab === "advanced" && (
        <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
          <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-ink-strong">Raw JSON editor</h3>
              <p className="text-xs text-ink-muted mt-0.5">
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
            className="w-full font-mono text-xs rounded-md border border-line bg-surface px-3 py-2 text-ink-strong focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-colors"
          />
          {parseError && (
            <p className="text-xs text-danger mt-2 font-medium">JSON error: {parseError}</p>
          )}
        </div>
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
    <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="companyName">Company name <span className="text-danger">*</span></Label>
          <Input id="companyName" value={profile.companyName} onChange={(e) => patch("companyName", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location">Headquarters location <span className="text-danger">*</span></Label>
          <Input id="location" value={profile.location} onChange={(e) => patch("location", e.target.value)} placeholder="Burbank, CA" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tagline">Tagline</Label>
        <Input
          id="tagline"
          value={profile.tagline}
          onChange={(e) => patch("tagline", e.target.value)}
          placeholder="a Southern-California managed-services provider"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="missionStatement">Mission statement</Label>
        <Textarea
          id="missionStatement"
          rows={2}
          value={profile.missionStatement}
          onChange={(e) => patch("missionStatement", e.target.value)}
          placeholder="One-sentence statement of what the company exists to do for customers."
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="brandVoice">Brand voice / tone</Label>
        <Textarea
          id="brandVoice"
          rows={3}
          value={profile.brandVoice}
          onChange={(e) => patch("brandVoice", e.target.value)}
          placeholder="Warm + direct, no fluff, no MBA-speak. Specific over generic."
        />
        <p className="text-[11px] text-ink-faint">
          Claude reads this as style rules for every output. Be specific — list do&apos;s and don&apos;ts.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="background">Company background</Label>
        <Textarea
          id="background"
          rows={4}
          value={profile.background}
          onChange={(e) => patch("background", e.target.value)}
          placeholder="A few sentences about the company's history, focus, and what makes the team distinctive."
        />
      </div>
    </div>
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
    <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
      <h3 className="text-sm font-semibold text-ink-strong mb-1">Services emphasis</h3>
      <p className="text-xs text-ink-muted mb-4">
        Tag each service. <strong className="text-ink-strong">[focus]</strong> services get pushed by the AI when
        they fit; <strong className="text-ink-strong">[de-emphasize]</strong> services are not proposed unless the
        customer explicitly asks. Optional note (200 chars) gives the AI context — e.g.
        &ldquo;Q2 push: new bundle&rdquo; or &ldquo;Capacity-constrained, only sell to existing accounts&rdquo;.
      </p>
      <div className="overflow-x-auto rounded-lg border border-line-subtle">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-surface-2">
            <tr>
              <th className="ui-label text-left px-3 py-2.5 w-48">Service line</th>
              <th className="ui-label text-left px-3 py-2.5 w-40">Emphasis</th>
              <th className="ui-label text-left px-3 py-2.5">Note (optional)</th>
            </tr>
          </thead>
          <tbody>
            {profile.services.map((s, i) => (
              <tr key={s.serviceLine} className="border-t border-line-subtle">
                <td className="px-3 py-2 font-medium text-ink-strong capitalize">{s.serviceLine.replace(/_/g, " ").toLowerCase()}</td>
                <td className="px-3 py-2">
                  <select
                    value={s.emphasis}
                    onChange={(e) => updateService(i, { emphasis: e.target.value as ServiceEmphasis })}
                    className="h-9 w-full rounded-md border border-line bg-surface px-2 text-sm text-ink-strong hover:border-line-strong focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-colors"
                  >
                    {EMPHASIS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
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
    </div>
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
    <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink-strong">{label}</h3>
          <p className="text-xs text-ink-muted mt-0.5">{helpText}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add
        </Button>
      </div>
      {values.length === 0 ? (
        <p className="text-xs text-ink-faint italic mt-3">No entries yet.</p>
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
                className="text-ink-faint hover:text-danger transition-colors"
                aria-label="Remove"
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
    <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-ink-strong">Real wins we can cite</h3>
          <p className="text-xs text-ink-muted mt-0.5 max-w-2xl">
            Anonymized customer wins the AI uses to ground objection rebuttals and
            outreach (&ldquo;we work with N other 50-seat medical practices&hellip;&rdquo;). Keep
            names out — use industry + size descriptors.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add win story
        </Button>
      </div>
      {profile.winStories.length === 0 ? (
        <p className="text-xs text-ink-faint italic">
          No win stories yet. Add a few to dramatically improve objection-coach output.
        </p>
      ) : (
        <ul className="space-y-3">
          {profile.winStories.map((w, i) => (
            <li key={i} className="border border-line-subtle rounded-lg p-3.5 space-y-3 bg-surface-2/40">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Industry</Label>
                  <select
                    value={w.industry}
                    onChange={(e) => update(i, { industry: e.target.value as Industry | "ANY" })}
                    className="h-8 rounded-md border border-line bg-surface px-2 text-xs text-ink-strong hover:border-line-strong focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-colors"
                  >
                    {ALL_INDUSTRIES.map((ind) => (
                      <option key={ind} value={ind}>{ind === "ANY" ? "Any" : ind.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-ink-faint hover:text-danger transition-colors"
                  aria-label="Remove win story"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Situation (anonymized)</Label>
                <Textarea
                  rows={2}
                  value={w.situation}
                  onChange={(e) => update(i, { situation: e.target.value })}
                  placeholder="50-seat medical practice on Comcast + ad-hoc help-desk, no compliance work"
                />
              </div>
              <div className="space-y-1.5">
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
    </div>
  );
}

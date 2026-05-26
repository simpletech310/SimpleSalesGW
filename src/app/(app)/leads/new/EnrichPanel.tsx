"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, Check, AlertTriangle, Globe } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * v3.3.9 — Lead enrichment panel.
 *
 * Sits at the top of the New Lead form. Rep enters a business name
 * (and optionally a website / city). Clicking "Look up online" calls
 * POST /api/leads/enrich. The result shows up as a per-field preview;
 * the rep clicks "Apply N fields" to populate the form fields via
 * native input events (the form is uncontrolled / FormData-driven so
 * setting `.value` + dispatching `input` is the right way in).
 */

type EnrichedField<T> = {
  value: T;
  confidence: number;
  source: "seed" | "website" | "claude" | "regex";
  sourceUrl?: string;
};

type EnrichmentResult = {
  fields: Record<string, EnrichedField<unknown>>;
  sourcesUsed: Array<{ url: string; kind: string; bytes: number }>;
  sourcesFailed: Array<{ url: string; reason: string }>;
  narrative: string;
  gaps: string[];
  rawText: string;
};

const FIELD_LABELS: Record<string, string> = {
  businessName: "Business name",
  dbaName: "DBA",
  industry: "Industry",
  subindustry: "Sub-industry",
  seatCount: "Seat count",
  siteCount: "Sites",
  addressStreet: "Street",
  addressCity: "City",
  addressState: "State",
  addressZip: "Zip",
  websiteUrl: "Website",
  linkedinCompanyUrl: "LinkedIn",
  googleBusinessUrl: "Google Business",
  primaryContactName: "Contact name",
  primaryContactTitle: "Contact title",
  primaryContactEmail: "Contact email",
  primaryContactPhone: "Contact phone",
  executiveSponsorName: "Sponsor name",
  executiveSponsorTitle: "Sponsor title",
  currentMspName: "Current MSP",
};

const SOURCE_BADGE: Record<string, string> = {
  website: "bg-brand-soft text-gtn-purple",
  claude: "bg-amber-100 text-amber-800",
  regex: "bg-gtn-green-bg text-gtn-green",
  seed: "bg-gtn-lavender text-gtn-grey-2",
};

// v3.3.12 — whitelabel the on-screen label for the underlying source.
// The API still returns "claude" as the source value (so existing
// snapshots and code paths don't break) but reps see "Gateway AI".
const SOURCE_LABEL: Record<string, string> = {
  website: "website",
  claude: "Gateway AI",
  regex: "regex",
  seed: "rep",
};

export function EnrichPanel({ formId }: { formId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EnrichmentResult | null>(null);
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<HTMLDetailsElement>(null);

  function getForm(): HTMLFormElement | null {
    return document.getElementById(formId) as HTMLFormElement | null;
  }
  function readField(name: string): string {
    const f = getForm();
    if (!f) return "";
    const el = f.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
    return el?.value ?? "";
  }

  async function lookUp() {
    const businessName = readField("businessName").trim();
    if (!businessName || businessName.length < 2) {
      setError("Enter a business name first, then click Look up online.");
      toast.error("Enter a business name first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const seed = {
        businessName,
        websiteUrl: readField("websiteUrl") || undefined,
        addressStreet: readField("addressStreet") || undefined,
        addressCity: readField("addressCity") || undefined,
        addressState: readField("addressState") || undefined,
        addressZip: readField("addressZip") || undefined,
        primaryContactName: readField("primaryContactName") || undefined,
        primaryContactEmail: readField("primaryContactEmail") || undefined,
        primaryContactPhone: readField("primaryContactPhone") || undefined,
      };
      const res = await fetch("/api/leads/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(seed),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error ?? "Enrichment failed";
        setError(msg);
        toast.error(msg);
        return;
      }
      setResult(data);
      // Pre-select all proposed fields by default
      const next: Record<string, boolean> = {};
      for (const k of Object.keys(data.fields ?? {})) next[k] = true;
      setChosen(next);
      const count = Object.keys(data.fields ?? {}).length;
      if (count === 0) {
        toast.message("We couldn't find anything on the web. Fill in manually below.");
      } else {
        toast.success(`Found ${count} fields — review below and apply.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function applySelected() {
    if (!result) return;
    const f = getForm();
    if (!f) return;
    let applied = 0;
    for (const [key, prop] of Object.entries(result.fields)) {
      if (!chosen[key]) continue;
      const el = f.elements.namedItem(key) as HTMLInputElement | HTMLSelectElement | null;
      if (!el) continue;
      const val = prop.value;
      el.value = typeof val === "string" ? val : String(val);
      // Notify React + native listeners
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      applied++;
    }
    toast.success(`Applied ${applied} field${applied === 1 ? "" : "s"} to the form.`);
  }

  const fieldEntries = result ? Object.entries(result.fields) : [];

  return (
    <section className="rounded-xl border border-brand/30 bg-brand-soft/20 p-4 md:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-gtn-navy flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-gtn-purple" />
            Don&apos;t have all the info? Look them up online.
          </h2>
          <p className="text-xs text-gtn-grey-2 mt-1 leading-relaxed">
            Enter the business name (plus optional website / city), and Gateway will scrape the public web to fill in
            owner, employee count, locations, phones, emails, LinkedIn, and industry. You review and approve before
            saving — nothing is auto-applied.
          </p>
        </div>
        <Button type="button" size="sm" onClick={lookUp} disabled={loading}>
          {loading ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Researching…</>
          ) : (
            <><Globe className="h-3.5 w-3.5 mr-1.5" /> Look up online</>
          )}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-gtn-red/30 bg-gtn-red/5 px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-gtn-red mt-0.5 flex-shrink-0" />
          <p className="text-xs text-gtn-red">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-3 pt-2 border-t border-line-subtle">
          {result.narrative && (
            <div className="rounded-md bg-surface border border-line-subtle p-3">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-purple mb-1">
                Pre-call brief
              </p>
              <p className="text-xs text-ink leading-relaxed whitespace-pre-wrap">{result.narrative}</p>
            </div>
          )}

          {fieldEntries.length > 0 ? (
            <div className="rounded-md bg-surface border border-line-subtle">
              <div className="px-3 py-2 border-b border-line-subtle flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs font-semibold text-gtn-navy">
                  {fieldEntries.length} proposed field{fieldEntries.length === 1 ? "" : "s"} — uncheck what you don&apos;t want
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-[11px] text-gtn-purple hover:underline"
                    onClick={() => setChosen(Object.fromEntries(fieldEntries.map(([k]) => [k, true])))}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-gtn-grey-2 hover:text-gtn-navy"
                    onClick={() => setChosen({})}
                  >
                    None
                  </button>
                </div>
              </div>
              <ul className="divide-y divide-line-subtle text-xs">
                {fieldEntries.map(([key, prop]) => {
                  const label = FIELD_LABELS[key] ?? key;
                  const v = prop.value;
                  const display = typeof v === "string" ? v : String(v);
                  const isChecked = chosen[key] !== false;
                  return (
                    <li key={key} className="px-3 py-2 flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-gtn-purple flex-shrink-0"
                        checked={isChecked}
                        onChange={(e) => setChosen((c) => ({ ...c, [key]: e.target.checked }))}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gtn-navy">{label}</span>
                          <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SOURCE_BADGE[prop.source] ?? "bg-surface-3 text-ink-muted"}`}>
                            {SOURCE_LABEL[prop.source] ?? prop.source}
                          </span>
                          <span className="text-[10px] text-ink-faint tabular">
                            {Math.round(prop.confidence * 100)}%
                          </span>
                        </div>
                        <p className="text-ink mt-0.5 break-all">{display}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="px-3 py-2 border-t border-line-subtle flex justify-end">
                <Button type="button" size="sm" onClick={applySelected}>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Apply {Object.values(chosen).filter(Boolean).length} to form
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gtn-grey-2 italic">
              No high-confidence fields found. The form is still yours — fill in manually below.
            </p>
          )}

          {result.gaps.length > 0 && (
            <div className="rounded-md bg-amber-50 border border-gtn-amber/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-amber mb-1">
                Still missing — ask on discovery
              </p>
              <ul className="text-xs text-gtn-navy list-disc list-inside space-y-0.5">
                {result.gaps.slice(0, 6).map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </div>
          )}

          {(result.sourcesUsed.length > 0 || result.sourcesFailed.length > 0) && (
            <details ref={sourceRef} className="text-xs">
              <summary className="cursor-pointer text-gtn-grey-2 hover:text-gtn-navy">
                Sources ({result.sourcesUsed.length} succeeded, {result.sourcesFailed.length} failed)
              </summary>
              <div className="mt-2 pl-3 space-y-1">
                {result.sourcesUsed.map((s, i) => (
                  <p key={`u-${i}`} className="text-ink truncate">
                    <span className="inline-block rounded bg-gtn-green-bg text-gtn-green px-1.5 py-0.5 text-[10px] font-semibold mr-2">{s.kind}</span>
                    <a className="text-gtn-purple hover:underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a>
                  </p>
                ))}
                {result.sourcesFailed.map((s, i) => (
                  <p key={`f-${i}`} className="text-ink-muted truncate">
                    <span className="inline-block rounded bg-gtn-red/10 text-gtn-red px-1.5 py-0.5 text-[10px] font-semibold mr-2">failed</span>
                    {s.url} <span className="text-ink-faint">— {s.reason}</span>
                  </p>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

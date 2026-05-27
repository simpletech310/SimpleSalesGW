"use client";

import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type DataBadgeVariant = "verified" | "rep-entered" | "mismatch";

export type DataProvenance = {
  /** Display label, e.g. "Seats", "Sites" */
  label: string;
  /** Value as it appears in the proposal (rep-entered or AI-derived). */
  proposalValue: number | string | null | undefined;
  /** Verified value from discovery (SiteSurvey.verifiedSeatCount/SiteCount). */
  verifiedValue: number | string | null | undefined;
};

function classify(p: DataProvenance): DataBadgeVariant {
  if (p.verifiedValue == null) return "rep-entered";
  if (p.proposalValue == null) return "rep-entered";
  return String(p.proposalValue) === String(p.verifiedValue) ? "verified" : "mismatch";
}

const STYLE: Record<DataBadgeVariant, { bg: string; ring: string; text: string; Icon: typeof HelpCircle; copy: string }> = {
  verified:      { bg: "bg-emerald-50",  ring: "ring-emerald-200", text: "text-emerald-900", Icon: CheckCircle2, copy: "Verified from site survey" },
  "rep-entered": { bg: "bg-amber-50",    ring: "ring-amber-200",   text: "text-amber-900",   Icon: HelpCircle,    copy: "Rep-entered, not yet verified" },
  mismatch:      { bg: "bg-red-50",      ring: "ring-red-200",     text: "text-red-900",     Icon: AlertTriangle, copy: "Mismatch — rep-entered differs from discovery" },
};

export function DataBadge({ provenance }: { provenance: DataProvenance }) {
  const variant = classify(provenance);
  const { bg, ring, text, Icon, copy } = STYLE[variant];
  const shown = provenance.proposalValue ?? "?";
  return (
    <span
      title={
        variant === "mismatch"
          ? `${copy}. Proposal says ${shown}; discovery verified ${provenance.verifiedValue}.`
          : variant === "verified"
          ? `${copy}: ${shown}.`
          : `${copy}: ${shown}.`
      }
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1",
        bg, ring, text,
      )}
    >
      <Icon className="h-3 w-3" />
      <span className="uppercase tracking-wide">{provenance.label}</span>
      <span className="font-mono">{String(shown)}</span>
      {variant === "mismatch" && (
        <span className="font-mono opacity-70">↯ {provenance.verifiedValue}</span>
      )}
    </span>
  );
}

export function DataBadgeRow({ items }: { items: DataProvenance[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((p, i) => (
        <DataBadge key={i} provenance={p} />
      ))}
    </div>
  );
}

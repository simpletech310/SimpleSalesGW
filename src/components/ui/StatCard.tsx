import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * v3.0 — KPI tile for the DashboardPage KPI strip.
 *
 * Compact, scannable, refined. Big tabular number; small label above;
 * delta + sub-label below; optional icon in the top-right corner.
 *
 * Use `href` to make the whole card a navigation target — the entire
 * surface becomes clickable, which is the right pattern for "click a
 * KPI to jump into the underlying view."
 */
type Tone = "neutral" | "brand" | "success" | "warn" | "danger";

export type StatCardProps = {
  label: string;
  value: React.ReactNode;
  /** Optional sub-label rendered under the value (e.g. "vs last week") */
  sub?: React.ReactNode;
  /** Numeric delta — positive renders green ↑, negative red ↓ */
  delta?: number;
  /** Custom delta formatter; defaults to "+12%" / "−4%" */
  formatDelta?: (delta: number) => string;
  /** Whether higher is better (controls delta color). Defaults true. */
  higherIsBetter?: boolean;
  /** Icon shown in the top-right tile */
  icon?: LucideIcon;
  /** Color treatment of the icon tile */
  tone?: Tone;
  /** Make the card a link */
  href?: string;
  className?: string;
};

export function StatCard({
  label,
  value,
  sub,
  delta,
  formatDelta,
  higherIsBetter = true,
  icon: Icon,
  tone = "brand",
  href,
  className,
}: StatCardProps) {
  const inner = (
    <div
      className={cn(
        "group relative rounded-xl bg-surface border border-line-subtle p-4 md:p-5",
        "transition-all duration-120 ease-smooth",
        href && "hover:border-line-strong hover:shadow-card cursor-pointer",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="ui-label">{label}</p>
        {Icon && (
          <span
            className={cn(
              "inline-flex items-center justify-center w-8 h-8 rounded-lg",
              toneIcon(tone),
            )}
            aria-hidden
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-baseline gap-3">
        <p className="ui-stat text-3xl md:text-4xl">{value}</p>
        {typeof delta === "number" && (
          <Delta value={delta} higherIsBetter={higherIsBetter} formatter={formatDelta} />
        )}
      </div>

      {sub && <p className="mt-2 text-sm text-ink-muted">{sub}</p>}

      {href && (
        <span
          aria-hidden
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-ink-faint"
        >
          <ArrowUpRight className="h-4 w-4" />
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

function Delta({
  value,
  higherIsBetter,
  formatter,
}: {
  value: number;
  higherIsBetter: boolean;
  formatter?: (v: number) => string;
}) {
  const isUp = value > 0;
  const isDown = value < 0;
  const good = (isUp && higherIsBetter) || (isDown && !higherIsBetter);
  const bad = (isDown && higherIsBetter) || (isUp && !higherIsBetter);
  const Icon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;
  const label = formatter
    ? formatter(value)
    : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value)}%`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold tabular px-1.5 py-0.5 rounded-md",
        good && "text-gtn-green bg-success-soft",
        bad && "text-gtn-red bg-danger-soft",
        !good && !bad && "text-ink-muted bg-surface-3",
      )}
    >
      <Icon className="h-3 w-3" />
      {label.replace(/^[+\-−]/, "")}
    </span>
  );
}

function toneIcon(tone: Tone): string {
  switch (tone) {
    case "success": return "bg-success-soft text-gtn-green";
    case "warn":    return "bg-warn-soft text-gtn-amber";
    case "danger":  return "bg-danger-soft text-gtn-red";
    case "neutral": return "bg-surface-3 text-ink-muted";
    case "brand":
    default:        return "bg-brand-soft text-gtn-purple";
  }
}

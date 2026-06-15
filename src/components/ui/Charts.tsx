import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * v3.7 — Lightweight, dependency-free dashboard visualizations.
 *
 * The portal ships no charting library on purpose (bundle weight + SSR). These
 * are pure SVG / CSS primitives that render on the server, theme off the brand
 * CSS variables (so they follow light/dark + brand tokens automatically), and
 * stay crisp at any size. Used across the rep / manager / vCIO home dashboards.
 *
 *   ProgressRing      — single 0–100% donut with a centered label
 *   SegmentDonut      — multi-segment donut (portfolio mix, etc.)
 *   MiniBars          — small vertical bar trend (e.g. closed-won / 6 mo)
 *   ConversionFunnel  — stage-to-stage pipeline funnel with drop-off %
 */

// Brand palette as CSS-var refs so charts re-theme automatically.
export const CHART_COLORS = {
  brand: "var(--gtn-purple)",
  brand2: "var(--gtn-purple-2)",
  navy: "var(--gtn-navy)",
  green: "var(--gtn-green)",
  amber: "var(--gtn-amber)",
  red: "var(--gtn-red)",
  track: "var(--gtn-lavender)",
} as const;

// ---------------------------------------------------------------------------
// ProgressRing — single value 0–100
// ---------------------------------------------------------------------------

export function ProgressRing({
  value,
  size = 64,
  stroke = 7,
  color = CHART_COLORS.brand,
  track = CHART_COLORS.track,
  label,
  sublabel,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  /** Centered label; defaults to the rounded percentage. */
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const center = size / 2;
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={center} cy={center} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-mono font-bold text-ink-strong" style={{ fontSize: size * 0.26 }}>
          {label ?? `${Math.round(pct)}%`}
        </span>
        {sublabel && <span className="text-[9px] text-ink-muted mt-0.5">{sublabel}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SegmentDonut — multi-segment ring
// ---------------------------------------------------------------------------

export type DonutSegment = { value: number; color: string; label: string };

export function SegmentDonut({
  segments,
  size = 132,
  stroke = 16,
  centerLabel,
  centerSub,
  className,
}: {
  segments: DonutSegment[];
  size?: number;
  stroke?: number;
  centerLabel?: React.ReactNode;
  centerSub?: React.ReactNode;
  className?: string;
}) {
  const total = segments.reduce((s, g) => s + g.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;
  let offset = 0;
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
          <circle cx={center} cy={center} r={r} fill="none" stroke={CHART_COLORS.track} strokeWidth={stroke} />
          {total > 0 &&
            segments.map((g, i) => {
              if (g.value <= 0) return null;
              const len = (g.value / total) * c;
              // 1px gap between segments for legibility.
              const gap = segments.filter((s) => s.value > 0).length > 1 ? 1.5 : 0;
              const seg = (
                <circle
                  key={i}
                  cx={center}
                  cy={center}
                  r={r}
                  fill="none"
                  stroke={g.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${Math.max(0, len - gap)} ${c - Math.max(0, len - gap)}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return seg;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="font-mono font-bold text-ink-strong text-2xl">{centerLabel ?? total}</span>
          {centerSub && <span className="text-[10px] text-ink-muted mt-0.5">{centerSub}</span>}
        </div>
      </div>
      <ul className="space-y-1.5 min-w-0">
        {segments.map((g, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: g.color }} aria-hidden />
            <span className="text-ink-muted truncate">{g.label}</span>
            <span className="ml-auto font-mono font-semibold text-ink-strong tabular">{g.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MiniBars — compact vertical bar trend
// ---------------------------------------------------------------------------

export function MiniBars({
  data,
  height = 56,
  color = CHART_COLORS.brand,
  mutedColor = CHART_COLORS.track,
  className,
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  color?: string;
  mutedColor?: string;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={cn("flex items-end gap-1.5", className)} style={{ height: height + 18 }}>
      {data.map((d, i) => {
        const isLast = i === data.length - 1;
        const h = Math.round((d.value / max) * height);
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0">
            <span className="text-[10px] font-mono font-semibold text-ink-strong tabular leading-none">
              {d.value > 0 ? d.value : ""}
            </span>
            <div
              className="w-full rounded-t transition-all"
              style={{
                height: Math.max(d.value > 0 ? 3 : 1, h),
                background: isLast ? color : mutedColor,
                minHeight: 2,
              }}
              title={`${d.label}: ${d.value}`}
            />
            <span className={cn("text-[9px] uppercase tracking-wide leading-none truncate w-full text-center", isLast ? "text-ink-strong font-semibold" : "text-ink-faint")}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConversionFunnel — stage-to-stage drop-off
// ---------------------------------------------------------------------------

export function ConversionFunnel({
  stages,
  className,
}: {
  stages: Array<{ label: string; count: number; href?: string; terminal?: boolean }>;
  className?: string;
}) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className={cn("space-y-1.5", className)}>
      {stages.map((s, i) => {
        const widthPct = Math.max(4, Math.round((s.count / max) * 100));
        const prev = i > 0 ? stages[i - 1]!.count : null;
        const conv = prev && prev > 0 ? Math.round((s.count / prev) * 100) : null;
        const RowInner = (
          <div className="group flex items-center gap-3">
            <span className="w-28 flex-shrink-0 text-[11px] text-ink-muted truncate text-right">{s.label}</span>
            <div className="flex-1 relative h-7">
              <div className="absolute inset-y-0 left-0 w-full rounded bg-surface-3/60" aria-hidden />
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded flex items-center px-2 transition-all",
                  s.terminal ? "bg-gtn-green/85" : "bg-gtn-purple/85 group-hover:bg-gtn-purple",
                )}
                style={{ width: `${widthPct}%` }}
              >
                <span className="text-[11px] font-mono font-bold text-white tabular">{s.count}</span>
              </div>
            </div>
            <span className="w-12 flex-shrink-0 text-[10px] font-semibold tabular text-right">
              {conv != null ? (
                <span className={conv >= 60 ? "text-gtn-green" : conv >= 30 ? "text-gtn-amber" : "text-ink-faint"}>
                  {conv}%
                </span>
              ) : (
                <span className="text-ink-faint">—</span>
              )}
            </span>
          </div>
        );
        return s.href ? (
          <Link key={i} href={s.href} className="block hover:opacity-95">
            {RowInner}
          </Link>
        ) : (
          <div key={i}>{RowInner}</div>
        );
      })}
    </div>
  );
}

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * v3.0 — unified Badge primitive.
 *
 * Absorbs the responsibilities of `gtn-stage-chip`, `gtn-score-badge`,
 * the inline role pill, and assorted ad-hoc status spans across the
 * codebase. One component, one source of truth for status color +
 * shape.
 *
 * Tone maps to the brand's semantic palette; shape controls the
 * outer geometry (pill vs. rounded rectangle); size handles density.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 font-medium whitespace-nowrap select-none",
  {
    variants: {
      tone: {
        neutral:  "bg-surface-3 text-ink-strong border border-line-subtle",
        brand:    "bg-brand-soft text-gtn-navy border border-transparent",
        accent:   "bg-gtn-purple text-white border border-transparent",
        navy:     "bg-gtn-navy text-white border border-transparent",
        success:  "bg-success-soft text-gtn-green border border-transparent",
        warn:     "bg-warn-soft text-gtn-amber border border-transparent",
        danger:   "bg-danger-soft text-gtn-red border border-transparent",
        outline:  "bg-transparent text-ink-strong border border-line",
        // Subtle "ghost" — for low-density meta tags
        muted:    "bg-transparent text-ink-muted border border-line-subtle",
      },
      shape: {
        pill:   "rounded-full",
        chip:   "rounded-md",
      },
      size: {
        xs: "text-[10px] tracking-wide uppercase font-semibold px-1.5 py-0.5",
        sm: "text-xs px-2 py-0.5",
        md: "text-xs px-2.5 py-1",
        lg: "text-sm px-3 py-1",
      },
    },
    defaultVariants: { tone: "neutral", shape: "pill", size: "sm" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Optional leading dot indicator */
  dot?: boolean;
}

export function Badge({
  className,
  tone,
  shape,
  size,
  dot,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, shape, size, className }))} {...props}>
      {dot && (
        <span
          aria-hidden
          className={cn(
            "inline-block w-1.5 h-1.5 rounded-full",
            tone === "success" && "bg-gtn-green",
            tone === "warn"    && "bg-gtn-amber",
            tone === "danger"  && "bg-gtn-red",
            tone === "brand"   && "bg-gtn-purple",
            tone === "accent"  && "bg-white/80",
            tone === "navy"    && "bg-gtn-eyebrow",
            (tone === "neutral" || tone === "outline" || tone === "muted") && "bg-ink-muted",
          )}
        />
      )}
      {children}
    </span>
  );
}

/**
 * ScoreBadge — drop-in replacement for the legacy gtn-score-badge.
 * Picks a tone automatically from a 0–100 score.
 */
export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  const tone = score >= 70 ? "success" : score >= 40 ? "warn" : "danger";
  return (
    <Badge tone={tone} shape="chip" size="md" className={cn("tabular font-mono", className)}>
      {score}
    </Badge>
  );
}

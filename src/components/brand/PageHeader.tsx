import * as React from "react";
import { cn } from "@/lib/utils";
import { Breadcrumb, type Crumb } from "@/components/ui/Breadcrumb";

/**
 * v3.0 — refined-SaaS page header used by all working-page templates.
 *
 * The legacy <PageHeaderBand /> (heavy navy strip) remains for print and
 * landing-style pages. <PageHeader /> is the *light* alternative used at
 * the top of every dashboard/list/detail/form route.
 *
 * Anatomy (top → bottom):
 *   - optional inline breadcrumb (above title)
 *   - optional eyebrow label
 *   - title row: <h1> + actions slot on the right
 *   - optional subtitle (one-liner explaining what the page does)
 *
 * Spacing and type tuned so the header gets out of the way fast — never
 * dominates the page.
 */
export type PageHeaderProps = {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-side action slot (e.g. primary CTA + secondary buttons) */
  actions?: React.ReactNode;
  /** Optional breadcrumb above the title */
  crumbs?: Crumb[];
  /** Optional badge cluster below the title (status pills, etc.) */
  meta?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  eyebrow,
  subtitle,
  actions,
  crumbs,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("mb-5 md:mb-6", className)}>
      {crumbs && crumbs.length > 0 && (
        <div className="mb-3">
          <Breadcrumb items={crumbs} home />
        </div>
      )}
      {eyebrow && <p className="ui-label mb-1.5">{eyebrow}</p>}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-ink-strong tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-sm md:text-[15px] text-ink-muted leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
          {meta && <div className="mt-3 flex items-center gap-2 flex-wrap">{meta}</div>}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-wrap md:flex-nowrap md:justify-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

/**
 * Section header — smaller h2 + optional actions, used inside templates
 * to label distinct content blocks (e.g. "Active leads", "Recent
 * handoffs"). Tighter than PageHeader.
 */
export function SectionHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4 mb-3", className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-ink-strong tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-ink-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

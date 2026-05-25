import * as React from "react";
import { Breadcrumb, type Crumb } from "@/components/ui/Breadcrumb";
import { RouteTabs } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils";

/**
 * v3.0 — DetailPage template.
 *
 * For every entity-detail screen: /leads/[id], /accounts/[id],
 * /sales/teams/[id], /sales/territories/[id], and single-tab admin
 * sub-pages.
 *
 * Anatomy:
 *   - Breadcrumb (back to the list it came from)
 *   - Entity hero: title + status badges + secondary metadata + action slot
 *   - Sub-nav tab strip (RouteTabs) when there are multiple tabs
 *   - Tab body — `children`
 *
 * Layout decisions: hero sits on the page background (no card), tabs sit
 * directly under the hero, and the tab body is whatever the route
 * renders (often <Card />s or a dense layout). This keeps the chrome
 * lightweight even on deeply nested screens.
 */
type TabSpec = {
  href: string;
  label: string;
  count?: number;
  exact?: boolean;
};

type Props = {
  /** Optional breadcrumb above the entity hero */
  crumbs?: Crumb[];
  /** Optional small eyebrow (e.g. "ACCOUNT", "LEAD") above the title */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** Short subtitle / one-liner (industry, location, owner) */
  subtitle?: React.ReactNode;
  /** Status pills / metadata badges shown beside or below the title */
  badges?: React.ReactNode;
  /** Right-side action slot (primary CTA, secondary buttons) */
  actions?: React.ReactNode;
  /** Tab strip — omit for single-tab detail pages */
  tabs?: TabSpec[];
  /** Tab body */
  children: React.ReactNode;
  className?: string;
};

export function DetailPage({
  crumbs,
  eyebrow,
  title,
  subtitle,
  badges,
  actions,
  tabs,
  children,
  className,
}: Props) {
  return (
    <div className={className}>
      {crumbs && crumbs.length > 0 && (
        <div className="mb-3">
          <Breadcrumb items={crumbs} home />
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-6 mb-4 md:mb-5">
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="ui-label mb-1">{eyebrow}</p>}
          <h1 className="text-2xl md:text-[28px] font-bold text-ink-strong tracking-tight leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm md:text-[15px] text-ink-muted">{subtitle}</p>
          )}
          {badges && (
            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">{badges}</div>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-wrap md:justify-end md:max-w-[60%]">
            {actions}
          </div>
        )}
      </div>

      {tabs && tabs.length > 0 && (
        <div className="mb-5 md:mb-6">
          <RouteTabs items={tabs} />
        </div>
      )}

      <div className={cn("space-y-5 md:space-y-6")}>{children}</div>
    </div>
  );
}

/**
 * Two-column detail layout for "main + side rail" patterns (e.g. lead
 * detail with a contact rail). Mobile collapses to single column.
 */
export function DetailSplit({
  main,
  aside,
  asideWidth = "320px",
  className,
}: {
  main: React.ReactNode;
  aside: React.ReactNode;
  asideWidth?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-[1fr_var(--aside-w)]",
        className,
      )}
      style={{ ["--aside-w" as never]: asideWidth }}
    >
      <div className="min-w-0 space-y-5 md:space-y-6">{main}</div>
      <aside className="space-y-5 md:space-y-6">{aside}</aside>
    </div>
  );
}

import * as React from "react";
import { PageHeader, type PageHeaderProps } from "@/components/brand/PageHeader";
import { cn } from "@/lib/utils";

/**
 * v3.0 — DashboardPage template.
 *
 * Standard shape for every portal home (Salesperson, Sales Manager, vCIO,
 * COO, Superadmin). Tight header + optional KPI strip + flexible body
 * where each portal drops its role-specific content.
 *
 * Body sections render with a consistent gap (`space-y-5 md:space-y-6`)
 * so the rhythm is the same across roles.
 */
type Props = PageHeaderProps & {
  /** KPI strip — typically 3-4 <StatCard /> children */
  kpis?: React.ReactNode;
  children?: React.ReactNode;
};

export function DashboardPage({
  title,
  subtitle,
  eyebrow,
  actions,
  meta,
  crumbs,
  kpis,
  children,
}: Props) {
  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        eyebrow={eyebrow}
        actions={actions}
        meta={meta}
        crumbs={crumbs}
      />
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5 md:mb-6">
          {kpis}
        </div>
      )}
      <div className="space-y-5 md:space-y-6">{children}</div>
    </div>
  );
}

/**
 * Card-like surface for dashboard sections. Use for "Recent leads", "Open
 * handoffs", etc. — anything that isn't already a self-contained card.
 */
export function DashboardSection({
  title,
  subtitle,
  actions,
  children,
  className,
  flush,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Drop padding so children can edge-to-edge (e.g. DataTable) */
  flush?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-xl bg-surface border border-line-subtle overflow-hidden",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-4 md:px-5 py-3.5 border-b border-line-subtle">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-ink-strong">{title}</h2>}
            {subtitle && <p className="text-sm text-ink-muted mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && "p-4 md:p-5")}>{children}</div>
    </section>
  );
}

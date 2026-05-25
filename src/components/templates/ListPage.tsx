import * as React from "react";
import { PageHeader, type PageHeaderProps } from "@/components/brand/PageHeader";
import { cn } from "@/lib/utils";

/**
 * v3.0 — ListPage template.
 *
 * For every "browse a collection" route: /leads, /accounts, /admin/users,
 * /admin/audit, /sales/teams, /notifications, /my-tasks, etc.
 *
 * Layout:
 *   - PageHeader (title + subtitle + primary CTA on the right)
 *   - Optional toolbar slot (search, filters, sort)
 *   - Body — typically a <DataTable /> (full-bleed inside a card) or
 *     custom grid (e.g. account portfolio cards).
 *
 * Pass `body` for full-bleed table rendering, `children` for padded content.
 */
type Props = PageHeaderProps & {
  /** Toolbar above the body (filters/search). Rendered inside a card frame. */
  toolbar?: React.ReactNode;
  /** Full-bleed body — use for DataTable or grid that brings its own card */
  body?: React.ReactNode;
  /** Padded body — wrapped in a card with default padding */
  children?: React.ReactNode;
};

export function ListPage({
  title,
  subtitle,
  eyebrow,
  actions,
  meta,
  crumbs,
  toolbar,
  body,
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
      {toolbar && (
        <div className="mb-4 rounded-xl bg-surface border border-line-subtle p-3 md:p-3.5">
          {toolbar}
        </div>
      )}
      {body}
      {children && !body && (
        <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
          {children}
        </div>
      )}
    </div>
  );
}

/** Optional pagination footer that aligns to the bottom of a DataTable card. */
export function ListPagination({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-3 flex items-center justify-between gap-3 text-sm text-ink-muted",
        className,
      )}
    >
      {children}
    </div>
  );
}

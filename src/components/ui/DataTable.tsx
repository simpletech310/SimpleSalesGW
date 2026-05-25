import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * v3.0 — Refined-SaaS DataTable.
 *
 * Headless-ish: you supply columns + rows, the component handles density,
 * hover, empty/loading states, and consistent styling. Built as a server
 * component (no React state) so it composes naturally inside server-side
 * list pages.
 *
 * For interactive needs (multi-select, client sort) wrap the rows in
 * client components — the rendering primitive itself is intentionally
 * dumb.
 */

export type Column<T> = {
  /** Stable key for React + sort hints */
  key: string;
  /** Header label */
  header: React.ReactNode;
  /** Cell renderer */
  cell: (row: T) => React.ReactNode;
  /** Tailwind alignment helper */
  align?: "left" | "right" | "center";
  /** Optional column width (CSS value passed to colgroup) */
  width?: string;
  /** Numeric column — applies tabular-nums + right alignment by default */
  numeric?: boolean;
  /** Hide on small screens */
  hideOnMobile?: boolean;
  /** Make this column sticky (only the first column should be sticky) */
  sticky?: boolean;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  /** Stable key per row */
  getRowKey: (row: T, index: number) => string;
  /** Make each row a link */
  getRowHref?: (row: T) => string | undefined;
  /** Loading placeholder rows count */
  loading?: boolean;
  /** What to show when rows is empty */
  empty?: React.ReactNode;
  /** Compact (28px) vs default (40px) rows */
  density?: "default" | "compact";
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  getRowHref,
  loading,
  empty,
  density = "default",
  className,
}: DataTableProps<T>) {
  const rowHeight = density === "compact" ? "h-9" : "h-12";
  const cellPad = density === "compact" ? "px-3" : "px-4";

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border border-line-subtle bg-surface",
        className,
      )}
    >
      <table className="w-full text-sm">
        <colgroup>
          {columns.map((c) => (
            <col key={c.key} style={c.width ? { width: c.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-line-subtle bg-surface-2">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  "h-10 ui-label text-left",
                  cellPad,
                  c.numeric && "text-right",
                  c.align === "right" && "text-right",
                  c.align === "center" && "text-center",
                  c.hideOnMobile && "hidden md:table-cell",
                  c.sticky && "sticky left-0 z-10 bg-surface-2",
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows columns={columns} rowHeight={rowHeight} cellPad={cellPad} />
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-10 text-center text-ink-muted">
                {empty ?? "Nothing here yet."}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const href = getRowHref?.(row);
              const cells = columns.map((c) => {
                const content = c.cell(row);
                return (
                  <td
                    key={c.key}
                    className={cn(
                      rowHeight,
                      cellPad,
                      "align-middle border-b border-line-subtle last:border-b-0",
                      c.numeric && "text-right tabular font-mono text-[13px]",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.hideOnMobile && "hidden md:table-cell",
                      c.sticky && "sticky left-0 z-10 bg-surface group-hover:bg-surface-3",
                    )}
                  >
                    {href ? (
                      <Link href={href} className="block w-full h-full -my-1 py-1 -mx-1 px-1">
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </td>
                );
              });
              return (
                <tr
                  key={getRowKey(row, i)}
                  className={cn(
                    "group transition-colors duration-120 ease-smooth",
                    "hover:bg-surface-3/60",
                  )}
                >
                  {cells}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function SkeletonRows<T>({
  columns,
  rowHeight,
  cellPad,
}: {
  columns: Column<T>[];
  rowHeight: string;
  cellPad: string;
}) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-line-subtle">
          {columns.map((c) => (
            <td key={c.key} className={cn(rowHeight, cellPad, c.hideOnMobile && "hidden md:table-cell")}>
              <div className="h-3 rounded bg-surface-3 animate-pulse" style={{ width: c.numeric ? "40%" : "70%", marginLeft: c.numeric ? "auto" : undefined }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

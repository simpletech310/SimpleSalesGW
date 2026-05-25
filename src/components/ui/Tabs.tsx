"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * v3.0 — Tabs primitives.
 *
 * Two flavors:
 *  - <TabsBar> + <Tab>          → client-only (controlled or routed via Link)
 *  - <RouteTabs items=[...]>    → server-friendly tab strip driven by current
 *                                  pathname. Used by DetailPage templates.
 *
 * Visual: underlined bottom edge with a 2px brand-purple active indicator
 * and a calm hover tint. The active indicator is rendered as a sibling
 * pseudo-bar so future Motion variants can animate between tabs without
 * layout reflow.
 */

type RouteTab = {
  href: string;
  label: string;
  /** Optional small count chip after the label (e.g. unread count) */
  count?: number;
  /** Exact match instead of startsWith */
  exact?: boolean;
};

export function RouteTabs({ items, className }: { items: RouteTab[]; className?: string }) {
  const pathname = usePathname() ?? "";
  return (
    <div
      className={cn(
        "flex items-stretch gap-1 border-b border-line-subtle overflow-x-auto",
        className,
      )}
      role="tablist"
    >
      {items.map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={active}
            data-tap-target
            className={cn(
              "relative inline-flex items-center gap-2 px-3.5 h-10 text-sm",
              "transition-colors duration-120 ease-smooth",
              "border-b-2 -mb-px",
              active
                ? "text-ink-strong border-brand font-semibold"
                : "text-ink-muted border-transparent hover:text-ink-strong hover:border-line",
            )}
          >
            <span className="whitespace-nowrap">{t.label}</span>
            {typeof t.count === "number" && (
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full",
                  "text-[10px] font-semibold tabular",
                  active
                    ? "bg-brand text-white"
                    : "bg-surface-3 text-ink-muted",
                )}
              >
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Plain underlined tab strip — when you have your own active-state logic.
 */
export function TabsBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-stretch gap-1 border-b border-line-subtle overflow-x-auto",
        className,
      )}
      role="tablist"
    >
      {children}
    </div>
  );
}

export function Tab({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      data-tap-target
      className={cn(
        "relative inline-flex items-center gap-2 px-3.5 h-10 text-sm",
        "transition-colors duration-120 ease-smooth",
        "border-b-2 -mb-px",
        active
          ? "text-ink-strong border-brand font-semibold"
          : "text-ink-muted border-transparent hover:text-ink-strong hover:border-line",
        className,
      )}
    >
      {children}
    </button>
  );
}

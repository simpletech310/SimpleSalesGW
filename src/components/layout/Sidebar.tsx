"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GatewayLogo } from "@/components/brand/GatewayLogo";
import { SignOutButton } from "./SignOutButton";
import { OfflineQueueBanner } from "./OfflineQueueBanner";
import { navForRole, roleDisplay } from "@/lib/nav/role-nav";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";

/**
 * v3.0.3 — refined-SaaS sidebar.
 *
 * White surface, grouped nav, lavender active fill with a 3px brand-purple
 * left bar. Replaces the v2.18 navy column. 240px wide, fixed on desktop
 * only; the mobile bottom-bar is handled by AppShell separately.
 *
 * Active-state logic: client component (usePathname), exact match for "/"
 * and startsWith for everything else.
 *
 * v3.0.3 — Sidebar now takes `user` only and computes its own nav from
 * `user.role`. Previously AppShell (server) called navForRole() and
 * passed the NavItem[] across to this client component, but each item
 * carries an `icon: LucideIcon` (a React component function) and
 * Next.js 15 rejects function props across the server → client
 * boundary at render time. Doing the lookup inside this client module
 * keeps the icon references local — they never cross a boundary.
 */
export function Sidebar({
  user,
}: {
  user: { name: string; email: string; role: Role };
}) {
  const pathname = usePathname() ?? "/";
  const nav = navForRole(user.role);
  const roleMeta = roleDisplay(user.role);

  return (
    <aside
      className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-60 z-30 bg-surface border-r border-line-subtle"
      aria-label="Primary navigation"
    >
      {/* Brand block — single navy slab at top */}
      <div className="px-5 h-[52px] flex items-center border-b border-line-subtle bg-gtn-navy">
        <Link href="/" className="block py-1.5 -my-1.5 px-1 -mx-1 rounded">
          <GatewayLogo variant="onDark" size="sm" />
        </Link>
      </div>

      {/* Grouped nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Primary">
        {nav.desktop.map((group, gi) => (
          <div key={gi} className="space-y-0.5">
            {group.label && (
              <p className="ui-label px-2.5 mb-1.5">{group.label}</p>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="ui-nav-item"
                  data-active={active}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" aria-hidden />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Identity block */}
      <div className="border-t border-line-subtle px-3 pt-3 pb-4 space-y-2.5">
        <div className="flex items-center gap-2.5 px-1">
          <div
            className="h-8 w-8 rounded-full bg-brand-soft text-gtn-navy flex items-center justify-center text-xs font-semibold flex-shrink-0 border border-line-subtle"
            aria-hidden
          >
            {initials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-strong truncate">{user.name}</p>
            <p className="text-[10px] uppercase tracking-wide text-ink-muted font-semibold truncate" title={roleMeta.tagline}>
              {roleMeta.label}
            </p>
          </div>
          <OfflineQueueBanner />
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}

/**
 * Active-state: exact for "/" so /leads doesn't also light up Home; otherwise
 * pathname is "active" if it equals the link or starts with it followed by "/".
 */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase();
}

/**
 * Mobile bottom-bar — kept as the v2.13 5-item Apple-friendly pattern but
 * restyled to the v3.0 token system. The "primary" slot is now a filled
 * pill (rather than the floating circle) for calmer, easier-to-tap UX.
 *
 * v3.0.3 — same fix as Sidebar: takes `role` and builds its own nav so
 * the icon function references never cross the server → client boundary.
 */
export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname() ?? "/";
  const nav = navForRole(role);
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-line-subtle z-40 flex justify-around items-stretch pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary mobile"
    >
      {nav.mobile.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-tap-target
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-2 flex-1 transition-colors",
              item.primary
                ? "text-gtn-purple"
                : active
                ? "text-gtn-navy"
                : "text-ink-muted hover:text-ink-strong",
            )}
          >
            <span
              className={cn(
                "inline-flex items-center justify-center rounded-full transition-all",
                item.primary
                  ? "w-10 h-10 bg-gtn-purple text-white shadow-[0_4px_14px_rgba(91,79,207,0.35)]"
                  : active
                  ? "w-8 h-8 bg-brand-soft text-gtn-navy"
                  : "w-8 h-8",
              )}
            >
              <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} aria-hidden />
            </span>
            <span className={cn("text-[10px] font-medium", item.primary && "text-gtn-purple")}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

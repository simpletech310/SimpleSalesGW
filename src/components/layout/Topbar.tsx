"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Bell } from "lucide-react";
import { GatewayLogo } from "@/components/brand/GatewayLogo";
import { roleDisplay } from "@/lib/nav/role-nav";
import { Breadcrumb, type Crumb } from "@/components/ui/Breadcrumb";
import { OfflineQueueBanner } from "./OfflineQueueBanner";
import { SignOutButton } from "./SignOutButton";
import type { Role } from "@prisma/client";

/**
 * v3.0 — slim app topbar.
 *
 * Desktop only — sits above main content (after the fixed sidebar). 52px
 * tall, hosts the breadcrumb on the left and global utilities on the
 * right (search trigger placeholder, notifications, role pill).
 *
 * Mobile renders its own compact header inside AppShell (logo + identity
 * + signout). The breadcrumb is hidden below md to free vertical space.
 */
export function Topbar({
  user,
}: {
  user: { name: string; email: string; role: Role };
}) {
  const pathname = usePathname() ?? "/";
  const crumbs = crumbsFromPath(pathname);
  const roleMeta = roleDisplay(user.role);

  return (
    <div className="ui-topbar sticky top-0 z-20">
      <div className="flex-1 min-w-0">
        <Breadcrumb items={crumbs} home={true} />
      </div>

      {/* Search trigger — visual only for now; ⌘K palette is a follow-up. */}
      <button
        type="button"
        className="ui-cmdk-trigger hidden lg:inline-flex"
        aria-label="Search"
        title="Search (coming soon)"
      >
        <Search className="h-3.5 w-3.5" aria-hidden />
        <span>Search…</span>
        <span className="ui-cmdk-kbd">⌘K</span>
      </button>

      <div className="flex items-center gap-1">
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="inline-flex items-center justify-center w-9 h-9 rounded-md text-ink-muted hover:text-ink-strong hover:bg-surface-3 transition-colors"
        >
          <Bell className="h-4 w-4" aria-hidden />
        </Link>
        <span
          className="hidden sm:inline-flex items-center text-[10px] uppercase tracking-wide font-semibold text-ink-muted px-2 py-1 rounded-md bg-surface-2 border border-line-subtle"
          title={roleMeta.tagline}
        >
          {roleMeta.label}
        </span>
      </div>
    </div>
  );
}

/**
 * Mobile compact header — replaces the v2.18 navy bar with a light bar
 * matching the new theme.
 */
export function MobileHeader({
  user,
}: {
  user: { name: string; email: string; role: Role };
}) {
  const roleMeta = roleDisplay(user.role);
  return (
    <header className="md:hidden bg-gtn-navy text-white">
      <div className="container flex items-center justify-between py-2.5">
        <Link href="/" className="flex items-center gap-3">
          <GatewayLogo variant="onDark" size="sm" />
        </Link>
        <div className="flex items-center gap-3">
          <OfflineQueueBanner />
          <div className="hidden xs:flex flex-col text-right">
            <span className="text-sm font-semibold">{user.name}</span>
            <span
              className="text-[10px] text-white/70 font-semibold tracking-wide uppercase"
              title={roleMeta.tagline}
            >
              {roleMeta.label}
            </span>
          </div>
          <SignOutButton variant="dark" />
        </div>
      </div>
    </header>
  );
}

/**
 * Build a breadcrumb from a route path. Best-effort: takes the path
 * segments, titlecases them, and stops at dynamic segments (where we
 * don't yet have a friendly name without data-fetching).
 *
 * For richer breadcrumbs on detail pages, the DetailPage template will
 * render its own breadcrumb above the entity hero using the loaded
 * entity name — the topbar one is just the structural fallback.
 */
function crumbsFromPath(pathname: string): Crumb[] {
  if (!pathname || pathname === "/") return [];
  const parts = pathname.split("/").filter(Boolean);
  const out: Crumb[] = [];
  let acc = "";
  for (const part of parts) {
    acc += `/${part}`;
    // Skip dynamic-looking segments (uuids, numeric ids); they'll show as raw on the detail page itself.
    if (/^[0-9a-f-]{20,}$/i.test(part) || /^\d+$/.test(part)) {
      continue;
    }
    out.push({ href: acc, label: titleCase(part) });
  }
  // Last crumb shouldn't be a link
  if (out.length > 0) out[out.length - 1]!.href = undefined;
  return out;
}

function titleCase(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

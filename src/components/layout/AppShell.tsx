import Link from "next/link";
import { GatewayLogo } from "@/components/brand/GatewayLogo";
import { BrandedFooter } from "@/components/brand/BrandedFooter";
import { STRINGS } from "@/lib/strings";
import type { Role } from "@prisma/client";
import { SignOutButton } from "./SignOutButton";
import { OfflineQueueBanner } from "./OfflineQueueBanner";
import { OnboardingTrigger } from "@/components/onboarding/OnboardingTrigger";
import { HelpButton } from "@/components/help/HelpButton";
import { navForRole, roleDisplay } from "@/lib/nav/role-nav";

type Props = {
  user: { name: string; email: string; role: Role };
  children: React.ReactNode;
};

/**
 * v2.18 — left-sidebar shell.
 *
 * Replaces the prior top horizontal nav with a fixed left sidebar on
 * desktop (md and up): logo + role-aware nav stack + user identity + sign
 * out. Mobile keeps the v2.13 bottom bar (sidebars don't work on a
 * phone). On md+ we shift the main content right via `md:pl-60` to make
 * room for the sidebar.
 */
export function AppShell({ user, children }: Props) {
  const nav = navForRole(user.role);
  const roleMeta = roleDisplay(user.role);

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar — fixed left */}
      <aside
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-60 bg-gtn-navy text-white z-30"
        aria-label="Primary navigation"
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <Link href="/" className="block">
            <GatewayLogo variant="onDark" size="sm" />
          </Link>
        </div>

        {/* Nav links — scrollable if many */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5" aria-label="Primary">
          {nav.desktop.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-white/85 hover:bg-gtn-navy-2 hover:text-white transition"
              >
                <Icon className="h-4 w-4 flex-shrink-0 text-white/75" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User identity + sign out — pinned bottom */}
        <div className="border-t border-white/10 px-4 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-full bg-gtn-purple flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
              aria-hidden
            >
              {initials(user.name)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <p
                className="text-[10px] uppercase tracking-wide text-white/65 font-semibold truncate"
                title={roleMeta.tagline}
              >
                {roleMeta.label}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <OfflineQueueBanner />
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Mobile top bar — slim, no nav links (those live in the bottom bar). */}
      <header className="md:hidden bg-gtn-navy text-white">
        <div className="container flex items-center justify-between py-3">
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
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Main content — left-shifted by sidebar width on md+ */}
      <div className="md:pl-60 flex flex-col min-h-dvh">
        <main className="flex-1 container pb-24 md:pb-8 pt-6">{children}</main>

        {/* v2.4 — first-run onboarding modal (one-time per user) */}
        <OnboardingTrigger role={user.role} />

        {/* v2.4 — floating Help button */}
        <HelpButton />

        {/* v2.4 — branded footer band (desktop only — sidebar already
            anchors brand context on every page). */}
        <div className="bg-white pt-6 pb-4 hidden md:block">
          <div className="container">
            <BrandedFooter
              versionLabel="V2.18 — 2026"
              centerLabel="GATEWAY TELNET"
              rightLabel={STRINGS.brand.tagline}
            />
          </div>
        </div>
      </div>

      {/* Mobile bottom nav — unchanged from v2.13 */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gtn-lavender-2 z-40 flex justify-around items-center pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary mobile"
      >
        {nav.mobile.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tap-target
              className="flex flex-col items-center justify-center gap-1 py-2 flex-1"
            >
              <span
                className={
                  item.primary
                    ? "w-12 h-12 rounded-full bg-gtn-navy flex items-center justify-center -mt-6 shadow-lg"
                    : ""
                }
              >
                <Icon
                  className={item.primary ? "h-6 w-6 text-white" : "h-5 w-5 text-gtn-grey"}
                  aria-hidden
                />
              </span>
              <span
                className={
                  item.primary
                    ? "text-[10px] text-gtn-navy font-semibold mt-0.5"
                    : "text-[10px] text-gtn-grey"
                }
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Compute 1-2 character initials for the user avatar disk. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase();
}

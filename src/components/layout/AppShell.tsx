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

export function AppShell({ user, children }: Props) {
  // v2.13 — nav now branches by role. Each role gets a different set of
  // top-bar items and a different bottom-nav (with a different "primary"
  // floating action). See src/lib/nav/role-nav.ts for the matrix.
  const nav = navForRole(user.role);
  const roleMeta = roleDisplay(user.role);

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Top app bar — navy Gateway banner */}
      <header className="bg-gtn-navy text-white">
        <div className="container flex items-center justify-between py-3">
          <Link href="/" className="flex items-center gap-3">
            <GatewayLogo variant="onDark" size="sm" />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {nav.desktop.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 rounded-md text-sm font-medium text-white/90 hover:bg-gtn-navy-2 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <OfflineQueueBanner />
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold">{user.name}</span>
              <span
                className="text-xs text-white/70 font-semibold tracking-wide uppercase"
                title={roleMeta.tagline}
              >
                {roleMeta.label}
              </span>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container pb-24 md:pb-8 pt-6">{children}</main>

      {/* v2.4 — first-run onboarding modal (one-time per user) */}
      <OnboardingTrigger role={user.role} />

      {/* v2.4 — floating Help button */}
      <HelpButton />

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gtn-lavender-2 z-40 flex justify-around items-center pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
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
              <span className={item.primary ? "text-[10px] text-gtn-navy font-semibold mt-0.5" : "text-[10px] text-gtn-grey"}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* v2.4 — branded footer band matching the SOP PDFs */}
      <div className="bg-white pt-6 pb-4 hidden md:block">
        <div className="container">
          <BrandedFooter
            versionLabel="V2.4 — 2026"
            centerLabel="GATEWAY TELNET"
            rightLabel={STRINGS.brand.tagline}
          />
        </div>
      </div>
    </div>
  );
}

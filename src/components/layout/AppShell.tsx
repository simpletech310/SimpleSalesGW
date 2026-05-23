import Link from "next/link";
import { Home, Users, Plus, Bell, User, Layers } from "lucide-react";
import { GatewayLogo } from "@/components/brand/GatewayLogo";
import { STRINGS } from "@/lib/strings";
import type { Role } from "@prisma/client";
import { SignOutButton } from "./SignOutButton";
import { OfflineQueueBanner } from "./OfflineQueueBanner";

type Props = {
  user: { name: string; email: string; role: Role };
  children: React.ReactNode;
};

const navItems = [
  { href: "/", label: STRINGS.nav.home, icon: Home },
  { href: "/leads", label: STRINGS.nav.leads, icon: Users },
  { href: "/leads/new", label: STRINGS.nav.newLead, icon: Plus, primary: true },
  { href: "/notifications", label: STRINGS.nav.notifications, icon: Bell },
  { href: "/me", label: STRINGS.nav.me, icon: User },
];

const desktopExtraItems = [
  { href: "/pipeline", label: STRINGS.nav.pipeline, icon: Layers },
];

export function AppShell({ user, children }: Props) {
  return (
    <div className="min-h-dvh flex flex-col">
      {/* Top app bar — navy Gateway banner */}
      <header className="bg-gtn-navy text-white">
        <div className="container flex items-center justify-between py-3">
          <Link href="/" className="flex items-center gap-3">
            <GatewayLogo variant="onDark" size="sm" />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {[...navItems, ...desktopExtraItems].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 rounded-md text-sm font-medium text-white/90 hover:bg-gtn-navy-2 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            {(user.role === "SUPERADMIN" || user.role === "COO") && (
              <Link
                href="/admin"
                className="px-3 py-2 rounded-md text-sm font-medium text-white/90 hover:bg-gtn-navy-2 hover:text-white"
              >
                {STRINGS.nav.admin}
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <OfflineQueueBanner />
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold">{user.name}</span>
              <span className="text-xs text-white/60">{user.role.replace("_", " ")}</span>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container pb-24 md:pb-8 pt-6">{children}</main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gtn-lavender-2 z-40 flex justify-around items-center pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        {navItems.map((item) => {
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

      {/* Footer — lavender to mirror PDF */}
      <footer className="bg-gtn-lavender border-t border-gtn-lavender-2 hidden md:block">
        <div className="container py-6 text-sm text-gtn-grey-2 flex items-center justify-between">
          <span>© Gateway TelNet</span>
          <span>{STRINGS.brand.tagline}</span>
        </div>
      </footer>
    </div>
  );
}

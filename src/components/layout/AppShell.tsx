import type { Role } from "@prisma/client";
import { Sidebar, MobileNav } from "./Sidebar";
import { Topbar, MobileHeader } from "./Topbar";
import { OnboardingTrigger } from "@/components/onboarding/OnboardingTrigger";
import { HelpButton } from "@/components/help/HelpButton";
import { navForRole } from "@/lib/nav/role-nav";

type Props = {
  user: { name: string; email: string; role: Role };
  children: React.ReactNode;
};

/**
 * v3.0 — unified app shell.
 *
 * Desktop (md+):
 *   - Fixed white left Sidebar (240px) with grouped nav.
 *   - Sticky slim Topbar (52px) with breadcrumb + utilities.
 *   - Main content sits in a max-width container with comfortable padding.
 *
 * Mobile:
 *   - Compact navy MobileHeader at top.
 *   - Bottom MobileNav (Apple-friendly 5 tap targets).
 *
 * The shell intentionally provides only the chrome. Per-page templates
 * (DashboardPage / ListPage / DetailPage / FormPage) handle page-level
 * structure inside `children`.
 */
export function AppShell({ user, children }: Props) {
  const nav = navForRole(user.role);

  return (
    <div className="min-h-dvh ui-app-bg">
      <Sidebar user={user} nav={nav} />
      <MobileHeader user={user} />

      <div className="md:pl-60 flex flex-col min-h-dvh">
        <div className="hidden md:block">
          <Topbar user={user} />
        </div>

        <main className="flex-1 px-4 md:px-8 pt-5 md:pt-6 pb-24 md:pb-10">
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </main>

        {/* First-run onboarding (one-time per user) */}
        <OnboardingTrigger role={user.role} />

        {/* Floating help button */}
        <HelpButton />
      </div>

      <MobileNav nav={nav} />
    </div>
  );
}

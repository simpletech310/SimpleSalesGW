import {
  Home,
  Users,
  Plus,
  Bell,
  User,
  Layers,
  Briefcase,
  CheckSquare,
  HelpCircle,
  DollarSign,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { Role } from "@prisma/client";
import { can } from "@/lib/rbac";
import { STRINGS } from "@/lib/strings";

/**
 * v2.13 — role-aware navigation.
 *
 * Why: the AppShell was rendering every nav link for every role, even though
 * a vCIO has no business adding a lead and a salesperson has no business
 * archiving an account. Each role gets a tailored set keyed off their RBAC
 * permissions + the surfaces they actually drive.
 *
 * Returned shape:
 *   desktop — full set, ordered as it should appear in the top app bar
 *   mobile  — top 5 (the iPhone bottom-nav budget). The 3rd slot is the
 *             "primary" floating action; for roles without lead-create the
 *             primary slot is whatever their highest-frequency action is.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Mobile bottom nav highlights one entry as the big floating action. */
  primary?: boolean;
};

const NAV = {
  home: { href: "/", label: STRINGS.nav.home, icon: Home },
  leads: { href: "/leads", label: STRINGS.nav.leads, icon: Users },
  newLead: { href: "/leads/new", label: STRINGS.nav.newLead, icon: Plus, primary: true },
  pipeline: { href: "/pipeline", label: STRINGS.nav.pipeline, icon: Layers },
  accounts: { href: "/accounts", label: STRINGS.nav.accounts, icon: Briefcase },
  notifications: { href: "/notifications", label: STRINGS.nav.notifications, icon: Bell },
  myTasks: { href: "/my-tasks", label: STRINGS.nav.myTasks, icon: CheckSquare },
  pricing: { href: "/pricing", label: STRINGS.nav.pricing, icon: DollarSign },
  me: { href: "/me", label: STRINGS.nav.me, icon: User },
  help: { href: "/help", label: STRINGS.nav.help, icon: HelpCircle },
  admin: { href: "/admin", label: STRINGS.nav.admin, icon: Shield },
} as const satisfies Record<string, NavItem>;

/** "Primary" alternates that replace +New for roles that don't create leads. */
const NAV_ALT = {
  /** vCIO's most-used action is opening their accounts portfolio. */
  accountsPrimary: { ...NAV.accounts, primary: true },
  /** COO's most-used action is accepting handoffs (lives in notifications). */
  notificationsPrimary: { ...NAV.notifications, primary: true },
} as const;

export type RoleNav = {
  desktop: ReadonlyArray<NavItem>;
  mobile: ReadonlyArray<NavItem>;
};

export function navForRole(role: Role): RoleNav {
  // v2.14 — add pricing:catalog:edit so Sales Manager sees the Admin link.
  const adminTail = (
    can(role, "user:manage") ||
    can(role, "audit:view") ||
    can(role, "system:config") ||
    can(role, "pricing:catalog:edit")
  )
    ? [NAV.admin]
    : [];

  switch (role) {
    case Role.SALESPERSON: {
      return {
        desktop: [
          NAV.home, NAV.leads, NAV.newLead, NAV.pipeline, NAV.notifications,
          NAV.myTasks, NAV.pricing, NAV.me, NAV.help,
        ],
        // Bottom nav: Home · Leads · +New (primary) · Notifications · Me
        mobile: [NAV.home, NAV.leads, NAV.newLead, NAV.notifications, NAV.me],
      };
    }

    case Role.SALES_MANAGER: {
      return {
        desktop: [
          NAV.home, NAV.leads, NAV.newLead, NAV.pipeline, NAV.notifications,
          NAV.myTasks, NAV.accounts, NAV.pricing, NAV.me, NAV.help,
          ...adminTail,
        ],
        // Same as salesperson — same primary action.
        mobile: [NAV.home, NAV.leads, NAV.newLead, NAV.notifications, NAV.me],
      };
    }

    case Role.VCIO: {
      // No /leads, no +New. Their world is /accounts, discoveries, QBRs, onboarding tasks.
      return {
        desktop: [
          NAV.home, NAV.accounts, NAV.myTasks, NAV.notifications,
          NAV.pricing, NAV.me, NAV.help,
        ],
        // Bottom nav: Home · Accounts · Accounts(primary) · My tasks · Me
        // The primary floating button is "Accounts" for one-tap access.
        mobile: [NAV.home, NAV.myTasks, NAV_ALT.accountsPrimary, NAV.notifications, NAV.me],
      };
    }

    case Role.COO: {
      // Ops focus: accept handoffs (notifications), browse accounts, see pipeline.
      // No +New. Notifications is the primary because handoffs land there.
      return {
        desktop: [
          NAV.home, NAV.notifications, NAV.accounts, NAV.pipeline, NAV.leads,
          NAV.myTasks, NAV.pricing, NAV.me, NAV.help,
          ...adminTail,
        ],
        mobile: [NAV.home, NAV.accounts, NAV_ALT.notificationsPrimary, NAV.myTasks, NAV.me],
      };
    }

    case Role.SUPERADMIN: {
      // Sees everything. Bottom nav matches sales manager for "default sales
      // operator" mode; admin lives at the end of desktop nav.
      return {
        desktop: [
          NAV.home, NAV.leads, NAV.newLead, NAV.pipeline, NAV.accounts,
          NAV.notifications, NAV.myTasks, NAV.pricing, NAV.me, NAV.help,
          ...adminTail,
        ],
        mobile: [NAV.home, NAV.leads, NAV.newLead, NAV.accounts, NAV.me],
      };
    }
  }
}

/** Short noun describing the role for headers and badges. */
export function roleDisplay(role: Role): { label: string; tagline: string } {
  switch (role) {
    case Role.SALESPERSON: return { label: "Salesperson", tagline: "Hunt, qualify, close." };
    case Role.SALES_MANAGER: return { label: "Sales Manager", tagline: "Team pipeline + pricing approvals." };
    case Role.VCIO: return { label: "vCIO", tagline: "Discovery, QBRs, strategic roadmap." };
    case Role.COO: return { label: "COO", tagline: "Handoffs, accounts, ops oversight." };
    case Role.SUPERADMIN: return { label: "Superadmin", tagline: "Everything." };
  }
}

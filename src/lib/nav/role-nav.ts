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
  UsersRound,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { Role } from "@prisma/client";
import { can } from "@/lib/rbac";
import { STRINGS } from "@/lib/strings";

/**
 * v3.0 — grouped, role-aware navigation.
 *
 * Sidebar now renders nav as labeled sections (Work / Pipeline / Manage /
 * Account) instead of one flat list. Each role still gets a tailored set
 * keyed off RBAC permissions — only the *grouping* and *visual shell* are
 * unified.
 *
 * Mobile bottom-bar shape is unchanged from v2.13 (Apple-friendly 5
 * tap-target pattern) — see `mobile` field.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Mobile bottom nav highlights one entry as the big primary action. */
  primary?: boolean;
};

export type NavGroup = {
  /** Quiet uppercase label shown above the group, or null for ungrouped first section */
  label: string | null;
  items: ReadonlyArray<NavItem>;
};

const NAV = {
  home:          { href: "/",              label: STRINGS.nav.home,          icon: Home },
  myTasks:       { href: "/my-tasks",      label: STRINGS.nav.myTasks,       icon: CheckSquare },
  notifications: { href: "/notifications", label: STRINGS.nav.notifications, icon: Bell },

  leads:         { href: "/leads",         label: STRINGS.nav.leads,         icon: Users },
  newLead:       { href: "/leads/new",     label: STRINGS.nav.newLead,       icon: Plus, primary: true },
  pipeline:      { href: "/pipeline",      label: STRINGS.nav.pipeline,      icon: Layers },
  accounts:      { href: "/accounts",      label: STRINGS.nav.accounts,      icon: Briefcase },
  pricing:       { href: "/pricing",       label: STRINGS.nav.pricing,       icon: DollarSign },

  sales:         { href: "/sales",         label: "Sales hub",               icon: UsersRound },
  admin:         { href: "/admin",         label: STRINGS.nav.admin,         icon: Shield },
  siteSurveys:   { href: "/vcio/site-surveys", label: "Site surveys",        icon: ClipboardCheck },

  me:            { href: "/me",            label: STRINGS.nav.me,            icon: User },
  help:          { href: "/help",          label: STRINGS.nav.help,          icon: HelpCircle },
} as const satisfies Record<string, NavItem>;

const NAV_ALT = {
  /** vCIO's most-used action is opening their accounts portfolio. */
  accountsPrimary:      { ...NAV.accounts,      primary: true },
  /** COO's most-used action is accepting handoffs. */
  notificationsPrimary: { ...NAV.notifications, primary: true },
} as const;

export type RoleNav = {
  /** Grouped desktop sidebar */
  desktop: ReadonlyArray<NavGroup>;
  /** Mobile bottom-bar (max 5 items; one may be `primary`) */
  mobile:  ReadonlyArray<NavItem>;
};

function adminTailFor(role: Role): NavItem[] {
  const allowed =
    can(role, "user:manage") ||
    can(role, "audit:view") ||
    can(role, "system:config") ||
    can(role, "pricing:catalog:edit") ||
    can(role, "msp:profile:edit");
  return allowed ? [NAV.admin] : [];
}

export function navForRole(role: Role): RoleNav {
  const admin = adminTailFor(role);

  switch (role) {
    case Role.SALESPERSON: {
      return {
        desktop: [
          { label: null,       items: [NAV.home, NAV.myTasks, NAV.notifications] },
          { label: "Pipeline", items: [NAV.leads, NAV.newLead, NAV.pipeline, NAV.pricing] },
          { label: "Account",  items: [NAV.me, NAV.help] },
        ],
        mobile: [NAV.home, NAV.leads, NAV.newLead, NAV.notifications, NAV.me],
      };
    }

    case Role.SALES_MANAGER: {
      return {
        desktop: [
          { label: null,       items: [NAV.home, NAV.myTasks, NAV.notifications] },
          { label: "Pipeline", items: [NAV.leads, NAV.newLead, NAV.pipeline, NAV.accounts, NAV.pricing] },
          { label: "Manage",   items: [NAV.sales, ...admin] },
          { label: "Account",  items: [NAV.me, NAV.help] },
        ],
        mobile: [NAV.home, NAV.leads, NAV.newLead, NAV.notifications, NAV.me],
      };
    }

    case Role.VCIO: {
      return {
        desktop: [
          { label: null,       items: [NAV.home, NAV.myTasks, NAV.notifications] },
          { label: "Pipeline",  items: [NAV.pipeline, NAV.siteSurveys, NAV.leads] },
          { label: "Portfolio", items: [NAV.accounts, NAV.pricing] },
          { label: "Account",  items: [NAV.me, NAV.help] },
        ],
        mobile: [NAV.home, NAV.siteSurveys, NAV_ALT.accountsPrimary, NAV.notifications, NAV.me],
      };
    }

    case Role.COO: {
      return {
        desktop: [
          { label: null,       items: [NAV.home, NAV.myTasks, NAV.notifications] },
          { label: "Pipeline", items: [NAV.accounts, NAV.pipeline, NAV.leads, NAV.siteSurveys, NAV.pricing] },
          { label: "Manage",   items: [...admin] },
          { label: "Account",  items: [NAV.me, NAV.help] },
        ],
        mobile: [NAV.home, NAV.accounts, NAV_ALT.notificationsPrimary, NAV.myTasks, NAV.me],
      };
    }

    case Role.SUPERADMIN: {
      return {
        desktop: [
          { label: null,       items: [NAV.home, NAV.myTasks, NAV.notifications] },
          { label: "Pipeline", items: [NAV.leads, NAV.newLead, NAV.pipeline, NAV.siteSurveys, NAV.accounts, NAV.pricing] },
          { label: "Manage",   items: [NAV.sales, NAV.admin] },
          { label: "Account",  items: [NAV.me, NAV.help] },
        ],
        mobile: [NAV.home, NAV.leads, NAV.newLead, NAV.accounts, NAV.me],
      };
    }
  }
}

/** Short noun describing the role for headers and badges. */
export function roleDisplay(role: Role): { label: string; tagline: string } {
  switch (role) {
    case Role.SALESPERSON:   return { label: "Salesperson",  tagline: "Hunt, qualify, close." };
    case Role.SALES_MANAGER: return { label: "Sales Manager", tagline: "Team pipeline + pricing approvals." };
    case Role.VCIO:          return { label: "vCIO",         tagline: "Discovery, QBRs, strategic roadmap." };
    case Role.COO:           return { label: "COO",          tagline: "Handoffs, accounts, ops oversight." };
    case Role.SUPERADMIN:    return { label: "Superadmin",   tagline: "Everything." };
  }
}

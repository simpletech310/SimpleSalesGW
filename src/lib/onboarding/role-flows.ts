/**
 * Per-role onboarding flows — plain-English walkthroughs shown to each user
 * the first time they log in. The same flows are also rendered (always
 * available) on /help so users can re-read them any time.
 *
 * Tone: like Lin describing the portal to a new hire over coffee. Short
 * sentences. No jargon. If a term is technical, link it through GlossaryTerm.
 */

import { Role } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  AlertOctagon,
  Briefcase,
  CheckSquare,
  Cog,
  DollarSign,
  FileSignature,
  HandHelping,
  Inbox,
  Layers,
  LineChart,
  MailPlus,
  MessageSquare,
  PenTool,
  Plus,
  PlusCircle,
  Sparkles,
  Target,
  UserPlus,
  Users,
} from "lucide-react";

export type OnboardingStep = {
  /** Stable key for analytics + dedup. */
  stepKey: string;
  /** Brand step icon. */
  Icon: LucideIcon;
  /** Plain-English title — what you'll do in this step. */
  title: string;
  /** 1–3 sentence plain-English explanation. */
  body: string;
  /** Optional CTA — links into the actual feature. */
  action?: { label: string; href: string };
};

export type OnboardingFlow = {
  /** Stable identifier — used to track dismissal. */
  flowKey: string;
  /** Role this flow targets. */
  role: Role;
  /** Cover-style display title. */
  title: string;
  /** One-line description shown under the title. */
  subtitle: string;
  /** Eyebrow text on the hero band. */
  eyebrow: string;
  /** 4–6 sequential steps. */
  steps: OnboardingStep[];
};

// -----------------------------------------------------------------------------
// SALESPERSON — Lin
// -----------------------------------------------------------------------------
const SALESPERSON_FLOW: OnboardingFlow = {
  flowKey: "v1-salesperson",
  role: Role.SALESPERSON,
  eyebrow: "WELCOME TO GATEWAY · SALES",
  title: "You bring leads from first contact to a signed SOW",
  subtitle:
    "The portal scores deals for you, routes pricing approvals automatically, and hands the customer cleanly over to Ops when the SOW is signed. Here's how to get rolling.",
  steps: [
    {
      stepKey: "create-lead",
      Icon: Plus,
      title: "Start with a new lead",
      body: "Tap the +New button in the bottom nav and fill in what you know. Don't worry about getting it perfect — the portal scores the deal the moment you save, and you can edit anything later.",
      action: { label: "Open the new-lead form", href: "/leads/new" },
    },
    {
      stepKey: "qualify",
      Icon: Target,
      title: "Score the qualification",
      body: "On the lead's page, scroll to the Qualification Scorecard. Rate eight dimensions (industry fit, size fit, authority, etc.) on simple sliders. Anything 60+ is a strong fit; 80+ is a lighthouse.",
    },
    {
      stepKey: "discovery",
      Icon: MessageSquare,
      title: "Run a discovery call",
      body: "Open the Discovery call form from the lead header. Take notes section-by-section (business, tech, decision, mini-pitch, close) so nothing slips. Optionally, send the customer a self-service assessment link.",
    },
    {
      stepKey: "pricing",
      Icon: DollarSign,
      title: "Request pricing if you need a discount",
      body: "On the Pricing card, set the bundle + seats and propose a number. Anything 5% off or less you self-approve. 5–20% routes to the Sales Manager. Above 20% (or below the floor) goes to the COO.",
    },
    {
      stepKey: "handoff",
      Icon: HandHelping,
      title: "Hand off to Ops when the SOW is signed",
      body: "Click 'Handoff to Ops' on the lead header. Fill the 8-section checklist — decision-makers, hard commitments, success criteria. The COO accepts and the customer auto-spawns under Accounts.",
    },
  ],
};

// -----------------------------------------------------------------------------
// SALES_MANAGER — Marcelo as sales manager
// -----------------------------------------------------------------------------
const SALES_MANAGER_FLOW: OnboardingFlow = {
  flowKey: "v1-sales-manager",
  role: Role.SALES_MANAGER,
  eyebrow: "WELCOME TO GATEWAY · SALES MANAGEMENT",
  title: "You keep the pipeline healthy and approve mid-tier pricing",
  subtitle:
    "Your daily work flows through /notifications and individual lead pages. Here's the short tour.",
  steps: [
    {
      stepKey: "notifications",
      Icon: Inbox,
      title: "Start every morning at /notifications",
      body: "Pending pricing approvals (5–20% off MRR) land here. So do handoffs you've been asked to weigh in on, and overdue next-actions on your team's leads.",
      action: { label: "Open notifications", href: "/notifications" },
    },
    {
      stepKey: "score-override",
      Icon: PenTool,
      title: "Override a deal-quality score when needed",
      body: "On any lead detail page, click 'Override scores' next to the score strip. The change is logged as an Activity with your reason, so the team sees why the number moved.",
    },
    {
      stepKey: "delete-lead",
      Icon: AlertOctagon,
      title: "Delete a lead with a reason",
      body: "Header → 'Delete lead'. A reason is required and goes into the audit log. Reserve this for true mistakes or duplicates; otherwise move to Nurture or Closed Lost.",
    },
    {
      stepKey: "export",
      Icon: LineChart,
      title: "Export leads for reporting",
      body: "/leads → Export CSV pulls everything visible to you with full scoring, owner, stage, expected close. Drop straight into Excel or your BI tool of choice.",
      action: { label: "Open the leads list", href: "/leads" },
    },
  ],
};

// -----------------------------------------------------------------------------
// VCIO — Teejay
// -----------------------------------------------------------------------------
const VCIO_FLOW: OnboardingFlow = {
  flowKey: "v1-vcio",
  role: Role.VCIO,
  eyebrow: "WELCOME TO GATEWAY · vCIO",
  title: "You take over after the handoff and own the customer relationship",
  subtitle:
    "Discovery, Inventory, the QBR cadence, and the strategic roadmap all live under /accounts. Here's the 5-step tour.",
  steps: [
    {
      stepKey: "accounts-list",
      Icon: Briefcase,
      title: "Visit /accounts to see your portfolio",
      body: "Every customer that came through a signed handoff is here. Pre-Sales-stage leads aren't — vCIO sees post-close only.",
      action: { label: "Open Accounts", href: "/accounts" },
    },
    {
      stepKey: "run-discovery",
      Icon: Sparkles,
      title: "Run the three Discoveries",
      body: "On any account: Site Survey (~120Q), AI Readiness (~120Q + use-case scoring), NIST CSF (106 Subcategories). For federal/CMMC customers, also run NIST 800-171 Supplemental (110 controls).",
    },
    {
      stepKey: "inventory",
      Icon: Layers,
      title: "Fill the MSP Inventory Workbook",
      body: "Account → Inventory. Ten structured tables: sites, circuits, firewalls, switches, APs, servers, storage, endpoints, licenses, vendors. Type-as-you-go; bulk paste-import is coming.",
    },
    {
      stepKey: "qbr",
      Icon: MessageSquare,
      title: "Schedule the first QBR ~Day 90",
      body: "Account → QBRs tab → 'Schedule QBR'. Pre-fills attendees from the lead contacts. After the meeting, fill outcomes + follow-ups — each follow-up auto-creates an onboarding task in Steady State.",
    },
    {
      stepKey: "roadmap",
      Icon: FileSignature,
      title: "Print the Strategic Roadmap",
      body: "Account → Roadmap. Aggregates AI 30/60/90, NIST CSF gap plan, outstanding onboarding tasks, and QBR follow-ups into a Gateway-branded print page.",
    },
  ],
};

// -----------------------------------------------------------------------------
// COO — Marcelo as ops
// -----------------------------------------------------------------------------
const COO_FLOW: OnboardingFlow = {
  flowKey: "v1-coo",
  role: Role.COO,
  eyebrow: "WELCOME TO GATEWAY · OPERATIONS",
  title: "You accept handoffs and approve high-tier pricing",
  subtitle:
    "Most of your daily work surfaces through /notifications. Audit and export tools live under /admin.",
  steps: [
    {
      stepKey: "pending-handoffs",
      Icon: Inbox,
      title: "Review pending handoffs",
      body: "When a salesperson initiates a handoff, it appears in /notifications under 'Handoffs to accept'. Click through to the lead's detail page, read the structured 60-field checklist, and Accept or Reject with a reason.",
      action: { label: "Open notifications", href: "/notifications" },
    },
    {
      stepKey: "auto-account",
      Icon: Briefcase,
      title: "Customer auto-creates on accept",
      body: "Accepting a handoff spawns the Customer record + materializes ~50 onboarding tasks across the 5 phases. The vCIO takes over from there. You can re-assign tasks to any user any time.",
    },
    {
      stepKey: "coo-pricing",
      Icon: DollarSign,
      title: "Approve COO-tier pricing requests",
      body: "Anything >20% off MRR, below-floor, or multi-year commits routes to you. /notifications shows them; click through to approve/reject with a decision note.",
    },
    {
      stepKey: "audit-export",
      Icon: LineChart,
      title: "Export the audit log",
      body: "/admin/audit → Export CSV. Every state change has been recorded with actor, before/after, IP. Useful for compliance reviews and post-mortems.",
      action: { label: "Open audit log", href: "/admin/audit" },
    },
  ],
};

// -----------------------------------------------------------------------------
// SUPERADMIN
// -----------------------------------------------------------------------------
const SUPERADMIN_FLOW: OnboardingFlow = {
  flowKey: "v1-superadmin",
  role: Role.SUPERADMIN,
  eyebrow: "WELCOME TO GATEWAY · ADMIN",
  title: "You manage users, templates, and the system catalog",
  subtitle:
    "Everything you need lives under /admin. Here's the lay of the land.",
  steps: [
    {
      stepKey: "add-teammate",
      Icon: UserPlus,
      title: "Add a teammate",
      body: "/admin/users → +New user. Pick their role; magic-link sign-in works out of the box. Password is a dev fallback.",
      action: { label: "Open users", href: "/admin/users" },
    },
    {
      stepKey: "pricing-catalog",
      Icon: DollarSign,
      title: "Edit the pricing catalog",
      body: "/admin/pricing — bundles, per-seat MRR tiers, floors, onboarding fees, service-line sub-tiers (vCIO Lite/Std/Complete, MIT Foundation/Complete/Complete+). JSON editor with a 'Reset to defaults' escape hatch.",
    },
    {
      stepKey: "outreach",
      Icon: MailPlus,
      title: "Manage outreach templates",
      body: "/admin/outreach — DB-backed template library, vertical + trigger filters, auto-detected {{placeholders}}. Lin sees the right templates auto-filtered by lead industry.",
    },
    {
      stepKey: "objections",
      Icon: MessageSquare,
      title: "Curate the objections library",
      body: "/admin/objections — categorized rebuttals. Add new entries when patterns emerge; mark stale ones inactive instead of deleting.",
    },
    {
      stepKey: "config",
      Icon: Cog,
      title: "Tune system config",
      body: "/admin/config — scoring thresholds (services-below, deal-quality-below). Keep these in sync with the playbook.",
      action: { label: "Open system config", href: "/admin/config" },
    },
  ],
};

// -----------------------------------------------------------------------------
// Registry
// -----------------------------------------------------------------------------
export const ROLE_FLOWS: Record<Role, OnboardingFlow> = {
  [Role.SALESPERSON]:   SALESPERSON_FLOW,
  [Role.SALES_MANAGER]: SALES_MANAGER_FLOW,
  [Role.VCIO]:          VCIO_FLOW,
  [Role.COO]:           COO_FLOW,
  [Role.SUPERADMIN]:    SUPERADMIN_FLOW,
};

export function flowFor(role: Role): OnboardingFlow {
  return ROLE_FLOWS[role];
}

// Quiet unused imports — they're referenced by step Icon assignments above.
void CheckSquare;
void PlusCircle;
void Users;

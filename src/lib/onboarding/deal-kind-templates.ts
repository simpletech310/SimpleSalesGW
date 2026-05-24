import { OnboardingPhase, Role } from "@prisma/client";
import type { TemplateKey } from "@/lib/pricing/deal-kinds";
import { TASK_TEMPLATES, type TaskTemplate } from "./task-templates";

/**
 * v2.15 — Onboarding template subsets per deal kind.
 *
 * The default `TASK_TEMPLATES` set assumes a full Managed-IT engagement
 * (Discovery + NIST + AI Readiness + Identity audit + …). Selling just a
 * phone system or just a cabling job means most of those tasks are noise.
 *
 * Each TemplateKey maps to either:
 *   - the full default set (FULL_MANAGED_IT)
 *   - a narrower lifecycle (3 phases instead of 5, smaller task list)
 *
 * Customer.create-from-handoff reads Lead.dealKind, looks up its
 * TemplateKey, and materializes only those tasks.
 */

// ---------------------------------------------------------------------------
// Specialised template sets (small, project-style)
// ---------------------------------------------------------------------------

/**
 * v2.16 — shared Salesperson + Sales Manager touchpoints for *every*
 * project-style deal kind (voice, cabling, access, video, custom).
 * The Salesperson stays connected through cutover; the Sales Manager
 * catches margin drift early and runs a quick retro before the team
 * moves on. createCustomerFromHandoff assigns SALESPERSON tasks to the
 * specific lead.ownerUserId, not the role bucket.
 */
const PROJECT_SP_SM_TEMPLATES: ReadonlyArray<TaskTemplate> = [
  { key: "sp.proj_kickoff_followup", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Post-kickoff client check-in",
    description: "Confirm scope expectations and timeline with the client a few days after kickoff.",
    dueOffsetDays: 5, defaultRole: Role.SALESPERSON },
  { key: "sp.proj_install_check", phase: OnboardingPhase.ONBOARD,
    title: "Install-week temperature check",
    description: "Stop by or call during install — anything off-spec? Surface to the COO immediately.",
    dueOffsetDays: 22, defaultRole: Role.SALESPERSON },
  { key: "sp.proj_closeout_check", phase: OnboardingPhase.STABILIZE,
    title: "Post-closeout client check-in + expansion",
    description: "Was the install clean? Any leftover needs the customer didn't know to ask for? (MSP, voice, cameras, access — whatever wasn't in scope this time.)",
    dueOffsetDays: 40, defaultRole: Role.SALESPERSON },
  { key: "sm.proj_margin_review", phase: OnboardingPhase.STABILIZE,
    title: "Project margin review",
    description: "Compare quoted line items vs. actual labor + materials. Catch scope creep before the next quote.",
    dueOffsetDays: 35, defaultRole: Role.SALES_MANAGER },
];

/** Voice-only install: kickoff → port + provision → train → close out. */
const VOICE_ONLY_TEMPLATES: ReadonlyArray<TaskTemplate> = [
  { key: "vo.contract", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Counter-sign Voice MSA + SOW",
    description: "Confirm both parties have signed; archive copy in Files.",
    dueOffsetDays: 1, defaultRole: Role.COO },
  { key: "vo.kickoff", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Kickoff call with primary contact",
    description: "Walk through cutover plan, training schedule, port timeline.",
    dueOffsetDays: 3, defaultRole: Role.COO },
  { key: "vo.loa", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Collect Letter of Authorization for number porting",
    description: "Required to port existing DIDs from the incumbent carrier.",
    dueOffsetDays: 5, defaultRole: Role.COO },
  { key: "vo.exit_pre", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Phase exit: contract signed, LOA received, kickoff held",
    dueOffsetDays: 7, defaultRole: Role.COO },

  { key: "vo.provision_tenant", phase: OnboardingPhase.ONBOARD,
    title: "Provision hosted PBX tenant + extensions",
    description: "Create user records, voicemail boxes, call routing skeleton.",
    dueOffsetDays: 10, defaultRole: Role.COO },
  { key: "vo.handset_ship", phase: OnboardingPhase.ONBOARD,
    title: "Ship + label handsets to site",
    description: "Pre-provisioned (zero-touch) to the tenant.",
    dueOffsetDays: 12, defaultRole: Role.COO },
  { key: "vo.port_request", phase: OnboardingPhase.ONBOARD,
    title: "Submit number-port request to losing carrier",
    description: "Track the firm order commitment date.",
    dueOffsetDays: 14, defaultRole: Role.COO },
  { key: "vo.install_handsets", phase: OnboardingPhase.ONBOARD,
    title: "On-site handset install + network verification",
    description: "PoE switch port, VLAN tag, QoS, registration confirmed.",
    dueOffsetDays: 21, defaultRole: Role.COO },
  { key: "vo.training", phase: OnboardingPhase.ONBOARD,
    title: "End-user training (30-min group session)",
    description: "Phone walkthrough, voicemail, mobile app, support flow.",
    dueOffsetDays: 22, defaultRole: Role.COO },
  { key: "vo.cutover", phase: OnboardingPhase.ONBOARD,
    title: "Cutover day: numbers port + go-live",
    description: "On-site or remote standby for the first hour. Test inbound + outbound.",
    dueOffsetDays: 28, defaultRole: Role.COO },
  { key: "vo.exit_ob", phase: OnboardingPhase.ONBOARD,
    title: "Phase exit: all extensions live + numbers ported",
    dueOffsetDays: 32, defaultRole: Role.COO },

  { key: "vo.30_day_check", phase: OnboardingPhase.STABILIZE,
    title: "30-day call quality + satisfaction check",
    description: "Pull MOS scores from PBX, short pulse to primary contact.",
    dueOffsetDays: 60, defaultRole: Role.COO },
  { key: "vo.steady_handoff", phase: OnboardingPhase.STABILIZE,
    title: "Hand off to steady-state support",
    description: "Customer knows ticket flow, billing in place, retention plan set.",
    dueOffsetDays: 65, defaultRole: Role.COO },
];

/** Voice + cameras combined: voice install plus camera install + NVR config. */
const VOICE_PLUS_VIDEO_TEMPLATES: ReadonlyArray<TaskTemplate> = [
  ...VOICE_ONLY_TEMPLATES,
  // Add video-specific tasks
  { key: "vpv.site_walk", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Camera placement site walk",
    description: "Confirm camera count + locations + power/PoE source per camera.",
    dueOffsetDays: 5, defaultRole: Role.COO },
  { key: "vpv.nvr_provision", phase: OnboardingPhase.ONBOARD,
    title: "Provision NVR + remote-viewing access",
    description: "Set retention policy, configure motion zones, share remote-view link.",
    dueOffsetDays: 18, defaultRole: Role.COO },
  { key: "vpv.camera_install", phase: OnboardingPhase.ONBOARD,
    title: "Install cameras + commission",
    description: "Mount, aim, PoE drop verify, label, recordings live.",
    dueOffsetDays: 24, defaultRole: Role.COO },
  { key: "vpv.client_walkthrough", phase: OnboardingPhase.ONBOARD,
    title: "Client walkthrough of camera + recording UI",
    description: "Train primary contact on live view, recorded clip export.",
    dueOffsetDays: 26, defaultRole: Role.COO },
];

/** Pure cabling install — no MRR, project closes when terminations cert. */
const CABLING_JOB_TEMPLATES: ReadonlyArray<TaskTemplate> = [
  { key: "cj.contract", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Counter-sign cabling SOW + COI",
    dueOffsetDays: 1, defaultRole: Role.COO },
  { key: "cj.site_survey", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "On-site cabling survey + drop schedule",
    description: "Walk every drop location, confirm pathway, plenum vs. non-plenum, photo each.",
    dueOffsetDays: 3, defaultRole: Role.COO },
  { key: "cj.permits", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Permits + landlord approvals (if required)",
    dueOffsetDays: 7, defaultRole: Role.COO },
  { key: "cj.materials", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Order materials (cable, plates, terminations, racks)",
    dueOffsetDays: 7, defaultRole: Role.COO },

  { key: "cj.crew_schedule", phase: OnboardingPhase.ONBOARD,
    title: "Schedule install crew + access",
    description: "Confirm site access window with property manager.",
    dueOffsetDays: 12, defaultRole: Role.COO },
  { key: "cj.install_drops", phase: OnboardingPhase.ONBOARD,
    title: "Pull + terminate all cabling drops",
    description: "Per the agreed drop schedule.",
    dueOffsetDays: 21, defaultRole: Role.COO },
  { key: "cj.cert_test", phase: OnboardingPhase.ONBOARD,
    title: "Cert test all drops + deliver test report",
    description: "Fluke cert per Cat6/Cat6a spec; share PDF with client.",
    dueOffsetDays: 24, defaultRole: Role.COO },
  { key: "cj.label_doc", phase: OnboardingPhase.ONBOARD,
    title: "Label panels + deliver as-built drawing",
    dueOffsetDays: 26, defaultRole: Role.COO },
  { key: "cj.closeout", phase: OnboardingPhase.ONBOARD,
    title: "Project closeout: walk + sign-off + final invoice",
    dueOffsetDays: 30, defaultRole: Role.COO },
];

/** Access-control project — door hardware + software licensing. */
const ACCESS_CONTROL_TEMPLATES: ReadonlyArray<TaskTemplate> = [
  { key: "ac.contract", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Counter-sign access-control SOW",
    dueOffsetDays: 1, defaultRole: Role.COO },
  { key: "ac.door_survey", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Per-door survey: hardware compatibility + power source",
    dueOffsetDays: 5, defaultRole: Role.COO },
  { key: "ac.user_inventory", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Collect cardholder roster + access groups",
    description: "Who gets in which doors when — drives software config.",
    dueOffsetDays: 7, defaultRole: Role.COO },

  { key: "ac.tenant_setup", phase: OnboardingPhase.ONBOARD,
    title: "Provision cloud access-control tenant",
    description: "Create cardholders, groups, schedules.",
    dueOffsetDays: 10, defaultRole: Role.COO },
  { key: "ac.door_install", phase: OnboardingPhase.ONBOARD,
    title: "Install readers + REX + door hardware",
    dueOffsetDays: 18, defaultRole: Role.COO },
  { key: "ac.card_issue", phase: OnboardingPhase.ONBOARD,
    title: "Issue + program credentials",
    dueOffsetDays: 22, defaultRole: Role.COO },
  { key: "ac.admin_training", phase: OnboardingPhase.ONBOARD,
    title: "Train client admin on console + audit reports",
    dueOffsetDays: 25, defaultRole: Role.COO },
  { key: "ac.closeout", phase: OnboardingPhase.ONBOARD,
    title: "Project closeout + handoff to support",
    dueOffsetDays: 30, defaultRole: Role.COO },
];

/** Video surveillance project — cameras + NVR + remote viewing. */
const VIDEO_SURVEILLANCE_TEMPLATES: ReadonlyArray<TaskTemplate> = [
  { key: "vs.contract", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Counter-sign video SOW",
    dueOffsetDays: 1, defaultRole: Role.COO },
  { key: "vs.site_walk", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Camera placement walk + retention requirements",
    description: "Per-camera FOV, mount type, retention days, motion zones.",
    dueOffsetDays: 4, defaultRole: Role.COO },
  { key: "vs.network_check", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Network capacity check (PoE budget, switch ports, VLAN)",
    dueOffsetDays: 6, defaultRole: Role.COO },

  { key: "vs.nvr_install", phase: OnboardingPhase.ONBOARD,
    title: "Install + configure NVR/DVR + storage",
    dueOffsetDays: 12, defaultRole: Role.COO },
  { key: "vs.camera_install", phase: OnboardingPhase.ONBOARD,
    title: "Install + aim cameras + verify recording",
    dueOffsetDays: 20, defaultRole: Role.COO },
  { key: "vs.remote_view", phase: OnboardingPhase.ONBOARD,
    title: "Set up remote-viewing app for primary contact",
    dueOffsetDays: 22, defaultRole: Role.COO },
  { key: "vs.training", phase: OnboardingPhase.ONBOARD,
    title: "Train client on live view + clip export",
    dueOffsetDays: 25, defaultRole: Role.COO },
  { key: "vs.closeout", phase: OnboardingPhase.ONBOARD,
    title: "Project closeout + handoff to support",
    dueOffsetDays: 30, defaultRole: Role.COO },
];

/** Custom mix — load all project templates as a starter, vCIO will prune. */
const CUSTOM_MIX_TEMPLATES: ReadonlyArray<TaskTemplate> = [
  { key: "cm.kickoff", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Project kickoff + scope confirmation",
    description: "Walk the signed SOW line-by-line so internal team knows what's in/out.",
    dueOffsetDays: 2, defaultRole: Role.COO },
  { key: "cm.task_seeding", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Seed custom onboarding tasks from the line-item quote",
    description: "Use Add Task inline — one task per material milestone in the SOW.",
    dueOffsetDays: 4, defaultRole: Role.VCIO },
  { key: "cm.exit_pre", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Phase exit: custom task list seeded + reviewed",
    dueOffsetDays: 7, defaultRole: Role.VCIO },
];

/**
 * v2.16 — every project-style template (everything except FULL_MANAGED_IT,
 * which has its own richer Salesperson schedule via TASK_TEMPLATES) gets
 * the shared SP+SM touchpoints folded in. Order doesn't matter — the
 * customer-create grouper sorts by phase before materializing rows.
 */
function withSpSm(base: ReadonlyArray<TaskTemplate>): ReadonlyArray<TaskTemplate> {
  return [...base, ...PROJECT_SP_SM_TEMPLATES];
}

const TEMPLATES_BY_KEY: Record<TemplateKey, ReadonlyArray<TaskTemplate>> = {
  FULL_MANAGED_IT: TASK_TEMPLATES, // already has SP+SM touchpoints from v2.16
  VOICE_ONLY: withSpSm(VOICE_ONLY_TEMPLATES),
  VOICE_PLUS_VIDEO: withSpSm(VOICE_PLUS_VIDEO_TEMPLATES),
  CABLING_JOB: withSpSm(CABLING_JOB_TEMPLATES),
  ACCESS_CONTROL: withSpSm(ACCESS_CONTROL_TEMPLATES),
  VIDEO_SURVEILLANCE: withSpSm(VIDEO_SURVEILLANCE_TEMPLATES),
  CUSTOM_MIX: withSpSm(CUSTOM_MIX_TEMPLATES),
};

export function templatesForKey(key: TemplateKey): ReadonlyArray<TaskTemplate> {
  return TEMPLATES_BY_KEY[key];
}

/**
 * v2.16 — Ownership matrix per template key. Helps the team see, at a
 * glance, that every role has skin in the game on every deal kind.
 * Returned in the canonical role order; used by /admin/setup and the
 * OnboardingPanel for the per-role task-count strip.
 */
export type OwnershipRow = {
  role: Role | "UNASSIGNED";
  count: number;
};
export function ownershipMatrix(key: TemplateKey): OwnershipRow[] {
  const tpl = TEMPLATES_BY_KEY[key];
  const counts: Record<string, number> = {
    SALESPERSON: 0, SALES_MANAGER: 0, VCIO: 0, COO: 0, SUPERADMIN: 0, UNASSIGNED: 0,
  };
  for (const t of tpl) {
    const k = t.defaultRole ?? "UNASSIGNED";
    counts[k] = (counts[k] ?? 0) + 1;
  }
  const rows: OwnershipRow[] = [
    { role: Role.SALESPERSON, count: counts.SALESPERSON ?? 0 },
    { role: Role.SALES_MANAGER, count: counts.SALES_MANAGER ?? 0 },
    { role: Role.VCIO, count: counts.VCIO ?? 0 },
    { role: Role.COO, count: counts.COO ?? 0 },
    { role: Role.SUPERADMIN, count: counts.SUPERADMIN ?? 0 },
    { role: "UNASSIGNED", count: counts.UNASSIGNED ?? 0 },
  ];
  return rows.filter((r) => r.count > 0);
}

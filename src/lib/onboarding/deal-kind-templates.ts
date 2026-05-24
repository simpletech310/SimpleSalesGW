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

const TEMPLATES_BY_KEY: Record<TemplateKey, ReadonlyArray<TaskTemplate>> = {
  FULL_MANAGED_IT: TASK_TEMPLATES,
  VOICE_ONLY: VOICE_ONLY_TEMPLATES,
  VOICE_PLUS_VIDEO: VOICE_PLUS_VIDEO_TEMPLATES,
  CABLING_JOB: CABLING_JOB_TEMPLATES,
  ACCESS_CONTROL: ACCESS_CONTROL_TEMPLATES,
  VIDEO_SURVEILLANCE: VIDEO_SURVEILLANCE_TEMPLATES,
  CUSTOM_MIX: CUSTOM_MIX_TEMPLATES,
};

export function templatesForKey(key: TemplateKey): ReadonlyArray<TaskTemplate> {
  return TEMPLATES_BY_KEY[key];
}

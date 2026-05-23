/**
 * Default onboarding task templates by phase.
 * Mirrors 04-Checklists/Master_Process_Checklist.md.
 * These are materialized as OnboardingTask rows when a Customer is created
 * (i.e. when Marcelo accepts a handoff).
 */

import { OnboardingPhase, Role } from "@prisma/client";

export type TaskTemplate = {
  /** Stable id used to dedupe + correlate later versions. */
  key: string;
  phase: OnboardingPhase;
  title: string;
  description?: string;
  /** Day offset (from onboardingStartedAt) at which this task is due. */
  dueOffsetDays?: number;
  /** v2.3 — default role for unassigned tasks. Drives /my-tasks role filter. */
  defaultRole?: Role;
};

export const TASK_TEMPLATES: ReadonlyArray<TaskTemplate> = [
  // ---------- PRE_ENGAGEMENT (Phase 0)
  { key: "pe.contract", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Counter-sign MSA and SOW",
    description: "Confirm both parties have signed; archive copy in Files.",
    dueOffsetDays: 1, defaultRole: Role.COO },
  { key: "pe.welcome_email", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Send welcome email to primary contact + executive sponsor",
    description: "Includes vCIO intro, project timeline, and Discovery date.",
    dueOffsetDays: 2, defaultRole: Role.VCIO },
  { key: "pe.psa_record", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Create company record in ConnectWise",
    description: "Includes site, contacts, agreement, billing terms.",
    dueOffsetDays: 3, defaultRole: Role.COO },
  { key: "pe.access_request", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Request initial access (tenant + admin credentials)",
    description: "M365 / Google Workspace global admin, AzureAD, firewall, etc.",
    dueOffsetDays: 5, defaultRole: Role.VCIO },
  { key: "pe.kickoff", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Schedule kickoff call",
    description: "vCIO + executive sponsor + primary contact. Set expectations and timeline.",
    dueOffsetDays: 5, defaultRole: Role.VCIO },
  { key: "pe.discovery_intro", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Send Discovery questionnaire to client stakeholders",
    description: "Heads up on what we'll ask; reserve calendar time.",
    dueOffsetDays: 5, defaultRole: Role.VCIO },
  { key: "pe.compliance_intake", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Capture compliance obligations and renewal dates",
    description: "Cyber insurance renewal, HIPAA / PCI / CMMC / state privacy applicability.",
    dueOffsetDays: 7, defaultRole: Role.VCIO },
  { key: "pe.exit_phase", phase: OnboardingPhase.PRE_ENGAGEMENT,
    title: "Phase exit: confirm everything above is in place to start Discovery",
    dueOffsetDays: 7, defaultRole: Role.VCIO },

  // ---------- DISCOVERY (Phase 1) — all owned by vCIO
  { key: "dc.site_survey", phase: OnboardingPhase.DISCOVERY,
    title: "Run MSP Site Survey (Discovery → New: Site Survey)",
    description: "Sites, connectivity, identity, endpoints, apps, backups, security stack.",
    dueOffsetDays: 14, defaultRole: Role.VCIO },
  { key: "dc.ai_readiness", phase: OnboardingPhase.DISCOVERY,
    title: "Run AI Readiness Questionnaire",
    description: "Org readiness, data foundations, use-case catalog by department.",
    dueOffsetDays: 18, defaultRole: Role.VCIO },
  { key: "dc.nist", phase: OnboardingPhase.DISCOVERY,
    title: "Run NIST CSF self-assessment (if regulated)",
    description: "Skip for non-regulated customers. Otherwise: 6 Functions × Categories.",
    dueOffsetDays: 21, defaultRole: Role.VCIO },
  { key: "dc.network_audit", phase: OnboardingPhase.DISCOVERY,
    title: "On-site / remote network audit",
    description: "Validate inventory, walk the wiring closet, confirm firewall posture.",
    dueOffsetDays: 14, defaultRole: Role.VCIO },
  { key: "dc.identity_audit", phase: OnboardingPhase.DISCOVERY,
    title: "Identity audit (M365 / Google Workspace)",
    description: "MFA coverage, conditional access, legacy auth, guest sprawl.",
    dueOffsetDays: 16, defaultRole: Role.VCIO },
  { key: "dc.backup_audit", phase: OnboardingPhase.DISCOVERY,
    title: "Backup and DR audit",
    description: "Verify backups exist for all critical systems; document RPO/RTO.",
    dueOffsetDays: 18, defaultRole: Role.VCIO },
  { key: "dc.findings_review", phase: OnboardingPhase.DISCOVERY,
    title: "Internal findings review (vCIO + COO)",
    description: "Consolidate findings; build remediation roadmap.",
    dueOffsetDays: 24, defaultRole: Role.VCIO },
  { key: "dc.client_readout", phase: OnboardingPhase.DISCOVERY,
    title: "Client readout meeting",
    description: "Present findings, scorecard, recommended roadmap. Get sign-off.",
    dueOffsetDays: 28, defaultRole: Role.VCIO },
  { key: "dc.exit_phase", phase: OnboardingPhase.DISCOVERY,
    title: "Phase exit: client has approved Discovery findings and roadmap",
    dueOffsetDays: 30, defaultRole: Role.VCIO },

  // ---------- ONBOARD (Phase 2) — mostly COO/ops; vCIO owns docs + compliance
  { key: "ob.rmm_deploy", phase: OnboardingPhase.ONBOARD,
    title: "Deploy RMM agent to all endpoints",
    description: "Confirm 100% coverage on workstations + servers. Document exceptions.",
    dueOffsetDays: 35, defaultRole: Role.COO },
  { key: "ob.av_edr", phase: OnboardingPhase.ONBOARD,
    title: "Deploy AV / EDR across fleet",
    description: "Mirror RMM coverage; verify quarantine and alert routing.",
    dueOffsetDays: 38, defaultRole: Role.COO },
  { key: "ob.backup_provisioning", phase: OnboardingPhase.ONBOARD,
    title: "Provision backups (per audit recommendations)",
    description: "Cloud + on-prem as needed; run first restore test before phase exit.",
    dueOffsetDays: 42, defaultRole: Role.COO },
  { key: "ob.mfa_enforcement", phase: OnboardingPhase.ONBOARD,
    title: "Enforce MFA on all admin and standard users",
    description: "Conditional access policies + legacy auth disabled.",
    dueOffsetDays: 40, defaultRole: Role.COO },
  { key: "ob.patch_baseline", phase: OnboardingPhase.ONBOARD,
    title: "Establish patch management baseline",
    description: "Approve patch policy, set maintenance windows, run first cycle.",
    dueOffsetDays: 45, defaultRole: Role.COO },
  { key: "ob.documentation", phase: OnboardingPhase.ONBOARD,
    title: "Capture IT documentation in ITGlue / Hudu",
    description: "Network diagram, credentials, runbooks, vendor list, contracts.",
    dueOffsetDays: 50, defaultRole: Role.VCIO },
  { key: "ob.helpdesk_intro", phase: OnboardingPhase.ONBOARD,
    title: "Introduce helpdesk to client end-users",
    description: "Email, posters, kickoff Q&A. Verify ticketing routes work.",
    dueOffsetDays: 45, defaultRole: Role.COO },
  { key: "ob.voip_or_other", phase: OnboardingPhase.ONBOARD,
    title: "Service-line specific provisioning (VoIP / cabling / AI / etc.)",
    description: "Skip rows that don't apply to this customer's bundle.",
    dueOffsetDays: 55, defaultRole: Role.COO },
  { key: "ob.cyber_baseline", phase: OnboardingPhase.ONBOARD,
    title: "Cybersecurity baseline hardening",
    description: "DNS filtering, email security, phishing simulation enrollment.",
    dueOffsetDays: 50, defaultRole: Role.COO },
  { key: "ob.network_remediation", phase: OnboardingPhase.ONBOARD,
    title: "Network remediation items from Discovery",
    description: "Switches, APs, firewall replacements, WAN upgrades as scoped.",
    dueOffsetDays: 60, defaultRole: Role.COO },
  { key: "ob.compliance_controls", phase: OnboardingPhase.ONBOARD,
    title: "Implement compliance controls (HIPAA / PCI / CMMC if applicable)",
    description: "Logging, retention, encryption, access reviews — scoped per NIST CSF gaps.",
    dueOffsetDays: 65, defaultRole: Role.VCIO },
  { key: "ob.exit_phase", phase: OnboardingPhase.ONBOARD,
    title: "Phase exit: all baseline systems deployed and verified",
    dueOffsetDays: 70, defaultRole: Role.VCIO },

  // ---------- STABILIZE (Phase 3)
  { key: "sb.ticket_rhythm", phase: OnboardingPhase.STABILIZE,
    title: "Confirm ticket volume and resolution rhythm",
    description: "First 2 weeks of MTTR data inside SLA targets.",
    dueOffsetDays: 80, defaultRole: Role.COO },
  { key: "sb.satisfaction", phase: OnboardingPhase.STABILIZE,
    title: "First customer satisfaction pulse",
    description: "Short survey to primary contact + executive sponsor.",
    dueOffsetDays: 75, defaultRole: Role.VCIO },
  { key: "sb.alert_tuning", phase: OnboardingPhase.STABILIZE,
    title: "Alert tuning pass",
    description: "Suppress noise, raise signal. Document on-call escalation.",
    dueOffsetDays: 75, defaultRole: Role.COO },
  { key: "sb.documentation_pass", phase: OnboardingPhase.STABILIZE,
    title: "Documentation correctness pass",
    description: "vCIO walks ITGlue/Hudu records; corrects anything drifted during ONBOARD.",
    dueOffsetDays: 78, defaultRole: Role.VCIO },
  { key: "sb.security_review", phase: OnboardingPhase.STABILIZE,
    title: "Security posture review",
    description: "Re-score against the original NIST/CSF baseline; confirm gains.",
    dueOffsetDays: 80, defaultRole: Role.VCIO },
  { key: "sb.first_qbr_scheduled", phase: OnboardingPhase.STABILIZE,
    title: "Schedule first QBR (~Day 90)",
    description: "Use the QBRs tab. Pre-populate attendees from Lead contacts.",
    dueOffsetDays: 80, defaultRole: Role.VCIO },
  { key: "sb.handoff_to_steady", phase: OnboardingPhase.STABILIZE,
    title: "Internal handoff to steady-state vCIO cadence",
    description: "vCIO + ops align on cadence; pause / archive onboarding-only checklists.",
    dueOffsetDays: 88, defaultRole: Role.VCIO },
  { key: "sb.exit_phase", phase: OnboardingPhase.STABILIZE,
    title: "Phase exit: customer is stable, first QBR scheduled",
    dueOffsetDays: 90, defaultRole: Role.VCIO },

  // ---------- STEADY_STATE (Phase 4) — recurring tasks created on cadence; vCIO owns
  { key: "ss.qbr_followups", phase: OnboardingPhase.STEADY_STATE,
    title: "Resolve open QBR follow-ups",
    description: "Items captured in the most recent QBR's follow-up list.",
    defaultRole: Role.VCIO },
  { key: "ss.roadmap_progress", phase: OnboardingPhase.STEADY_STATE,
    title: "Update strategic roadmap progress",
    description: "Re-run roadmap renderer; mark completed items; shift dates if slipped.",
    defaultRole: Role.VCIO },
  { key: "ss.security_quarterly", phase: OnboardingPhase.STEADY_STATE,
    title: "Quarterly security review",
    description: "MFA coverage check, patch compliance, backup restore test.",
    defaultRole: Role.VCIO },
  { key: "ss.satisfaction_check", phase: OnboardingPhase.STEADY_STATE,
    title: "Quarterly satisfaction check-in",
    description: "Short pulse to executive sponsor; track NPS trend.",
    defaultRole: Role.VCIO },
  { key: "ss.contract_review", phase: OnboardingPhase.STEADY_STATE,
    title: "Annual contract / renewal review",
    description: "Pricing, scope changes, headcount drift, expansion opportunities.",
    dueOffsetDays: 365, defaultRole: Role.SALES_MANAGER },
  { key: "ss.compliance_recert", phase: OnboardingPhase.STEADY_STATE,
    title: "Compliance recertification (if applicable)",
    description: "Cyber insurance renewal, CMMC re-attestation, HIPAA review.",
    dueOffsetDays: 330, defaultRole: Role.VCIO },
];

/** Returns the templates that should be materialized on day 1 of onboarding. */
export function getInitialTaskTemplates(): ReadonlyArray<TaskTemplate> {
  return TASK_TEMPLATES;
}

/** Returns templates filtered to a single phase, ordered by their original position. */
export function templatesForPhase(phase: OnboardingPhase): ReadonlyArray<TaskTemplate> {
  return TASK_TEMPLATES.filter((t) => t.phase === phase);
}

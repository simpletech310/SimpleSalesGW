import type { DiscoveryBank, DiscoveryQuestion } from "./types";

/**
 * v3.8 — SOC 2 readiness interview (~38 Q).
 * Walks the common-criteria control areas an auditor probes (governance,
 * access, change mgmt, vendor, risk, incident response, monitoring, encryption,
 * HR, BCP/DR, evidence). Each maturity question is tier-weighted (0/1/2) so
 * `soc2-interview.ts` can emit a readiness % + band alongside gaps/next steps.
 */

/** Standard 3-level maturity scale used across most control questions. */
const maturity = [
  { value: "yes", label: "Yes — documented & operating", weight: 2 },
  { value: "partial", label: "Partial / informal", weight: 1 },
  { value: "no", label: "No / not in place", weight: 0 },
  { value: "unknown", label: "Unknown", weight: 0 },
];

function tier(id: string, section: string, prompt: string, required = false): DiscoveryQuestion {
  return { id, section, prompt, type: "single_select", required, options: maturity };
}
function single(id: string, section: string, prompt: string, options: ReadonlyArray<{ value: string; label: string; weight?: number }>, required = false): DiscoveryQuestion {
  return { id, section, prompt, type: "single_select", required, options };
}
function multi(id: string, section: string, prompt: string, options: ReadonlyArray<{ value: string; label: string }>, required = false): DiscoveryQuestion {
  return { id, section, prompt, type: "multi_select", required, options };
}
function text(id: string, section: string, prompt: string, helpText?: string, required = false): DiscoveryQuestion {
  return { id, section, prompt, helpText, type: "text", required };
}

export const SOC2_INTERVIEW_QUESTIONS: ReadonlyArray<DiscoveryQuestion> = [
  // Scope
  multi("SOC01", "Scope", "Which Trust Services Criteria are in scope?", [
    { value: "security", label: "Security (required)" },
    { value: "availability", label: "Availability" },
    { value: "confidentiality", label: "Confidentiality" },
    { value: "processing", label: "Processing Integrity" },
    { value: "privacy", label: "Privacy" },
  ], true),
  single("SOC02", "Scope", "Type I or Type II target?", [
    { value: "type1", label: "Type I (point in time)" },
    { value: "type2", label: "Type II (period of time)" },
    { value: "undecided", label: "Undecided" },
  ]),
  single("SOC03", "Scope", "Have they been audited before?", [
    { value: "yes_soc2", label: "Yes — prior SOC 2" },
    { value: "other", label: "Other framework (ISO, HIPAA, PCI)" },
    { value: "no", label: "No — first time" },
  ]),
  text("SOC04", "Scope", "Target audit date / driver (customer requirement, sales, etc.)"),

  // Governance & policy
  tier("SOC05", "Governance", "Information security policies documented & reviewed annually?"),
  tier("SOC06", "Governance", "Is there an assigned security owner / officer?"),
  tier("SOC07", "Governance", "Acceptable use & code of conduct acknowledged by staff?"),
  tier("SOC08", "Governance", "Risk assessment performed at least annually?"),

  // Access control
  tier("SOC09", "Access control", "Unique user IDs + least-privilege access enforced?"),
  tier("SOC10", "Access control", "MFA enforced on email, VPN, and critical systems?"),
  tier("SOC11", "Access control", "Access reviews performed on a regular cadence?"),
  tier("SOC12", "Access control", "Privileged/admin access restricted & logged?"),
  tier("SOC13", "Access control", "Password policy / SSO in place?"),

  // Change management
  tier("SOC14", "Change management", "Documented change management process for systems/code?"),
  tier("SOC15", "Change management", "Changes tested & approved before production?"),
  tier("SOC16", "Change management", "Separate dev / test / prod environments?"),

  // Vendor / third-party
  tier("SOC17", "Vendor management", "Vendor inventory with risk tiering maintained?"),
  tier("SOC18", "Vendor management", "Subservice org SOC reports reviewed annually?"),

  // Risk & monitoring
  tier("SOC19", "Monitoring", "Centralized logging / SIEM for critical systems?"),
  tier("SOC20", "Monitoring", "Alerting on security events with defined response?"),
  tier("SOC21", "Monitoring", "Vulnerability scanning performed regularly?"),
  tier("SOC22", "Monitoring", "Penetration test performed at least annually?"),

  // Incident response
  tier("SOC23", "Incident response", "Documented incident response plan?"),
  tier("SOC24", "Incident response", "IR plan tested / tabletop exercise done?"),
  tier("SOC25", "Incident response", "Customer breach-notification process defined?"),

  // Data protection
  tier("SOC26", "Data protection", "Data encrypted in transit (TLS) and at rest?"),
  tier("SOC27", "Data protection", "Data classification & handling policy?"),
  tier("SOC28", "Data protection", "Secure data disposal / media sanitization process?"),
  tier("SOC29", "Data protection", "Endpoint protection (EDR) deployed & managed?"),

  // HR / personnel
  tier("SOC30", "Personnel", "Background checks for new hires?"),
  tier("SOC31", "Personnel", "Security awareness training at hire + annually?"),
  tier("SOC32", "Personnel", "Documented onboarding / offboarding (access revocation)?"),

  // Availability / BCP-DR
  tier("SOC33", "Availability", "Backups performed and restores tested?"),
  tier("SOC34", "Availability", "Business continuity / disaster recovery plan documented?"),
  tier("SOC35", "Availability", "Defined RTO / RPO targets?"),

  // Evidence readiness
  single("SOC36", "Evidence", "How ready is evidence collection (tickets, logs, approvals)?", [
    { value: "automated", label: "Automated / compliance tooling", weight: 2 },
    { value: "manual", label: "Manual but available", weight: 1 },
    { value: "none", label: "No evidence trail yet", weight: 0 },
  ]),
  text("SOC37", "Evidence", "Biggest known gaps the customer already admits to"),
  text("SOC38", "Evidence", "Anything else the vCIO should flag for the readiness roadmap"),
];

export const SOC2_INTERVIEW_BANK: DiscoveryBank = {
  kind: "SOC2_INTERVIEW",
  questions: SOC2_INTERVIEW_QUESTIONS,
};

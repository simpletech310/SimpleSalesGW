import type { DiscoveryBank, DiscoveryQuestion } from "./types";

/**
 * NIST CSF 2.0 self-assessment.
 * Six Functions × one rolled-up question per major Category to keep this
 * tractable for a Discovery interview. Each option has a Tier weight 1-4
 * (1=Partial, 2=Risk-Informed, 3=Repeatable, 4=Adaptive).
 *
 * Mirrors 05-NIST-Cybersecurity-Audit/NIST_CSF_Assessment_TEMPLATE.md but
 * compressed for portal use. Evidence text is captured per Function via the
 * trailing free-text question.
 */

const tierOptions = [
  { value: "tier_1", label: "Tier 1 — Partial (ad-hoc, reactive)", weight: 1 },
  { value: "tier_2", label: "Tier 2 — Risk-Informed (some process, not enforced)", weight: 2 },
  { value: "tier_3", label: "Tier 3 — Repeatable (formal, consistent)", weight: 3 },
  { value: "tier_4", label: "Tier 4 — Adaptive (continuous improvement)", weight: 4 },
];

function tierQ(id: string, section: string, prompt: string): DiscoveryQuestion {
  return { id, section, prompt, type: "single_select", required: true, options: tierOptions };
}

export const NIST_CSF_QUESTIONS: ReadonlyArray<DiscoveryQuestion> = [
  // Govern
  tierQ("GV01", "Govern", "Risk management strategy is documented and reviewed"),
  tierQ("GV02", "Govern", "Roles and responsibilities for cybersecurity are defined"),
  tierQ("GV03", "Govern", "Policies (acceptable use, incident response, data handling) are current"),
  tierQ("GV04", "Govern", "Supply chain / vendor risk is actively managed"),
  { id: "GV99", section: "Govern", prompt: "Evidence / notes for Govern", type: "text", required: false },

  // Identify
  tierQ("ID01", "Identify", "Asset inventory (hardware + software) is current"),
  tierQ("ID02", "Identify", "Data inventory + classification exists"),
  tierQ("ID03", "Identify", "Threat + vulnerability awareness program is in place"),
  tierQ("ID04", "Identify", "Risk assessment performed and updated regularly"),
  { id: "ID99", section: "Identify", prompt: "Evidence / notes for Identify", type: "text", required: false },

  // Protect
  tierQ("PR01", "Protect", "Identity + access management (MFA, least privilege)"),
  tierQ("PR02", "Protect", "Data protection at rest and in transit (encryption)"),
  tierQ("PR03", "Protect", "Endpoint protection (EDR/AV) deployed and current"),
  tierQ("PR04", "Protect", "Security awareness training cadence"),
  tierQ("PR05", "Protect", "Backups verified with periodic restore tests"),
  { id: "PR99", section: "Protect", prompt: "Evidence / notes for Protect", type: "text", required: false },

  // Detect
  tierQ("DE01", "Detect", "Security monitoring (SIEM / EDR alerting)"),
  tierQ("DE02", "Detect", "Logs collected and retained per policy"),
  tierQ("DE03", "Detect", "Anomaly + threat detection in place"),
  { id: "DE99", section: "Detect", prompt: "Evidence / notes for Detect", type: "text", required: false },

  // Respond
  tierQ("RS01", "Respond", "Incident response plan documented + tabletop-tested"),
  tierQ("RS02", "Respond", "Communications plan (internal + customer + legal)"),
  tierQ("RS03", "Respond", "Forensics / evidence-preservation capability"),
  { id: "RS99", section: "Respond", prompt: "Evidence / notes for Respond", type: "text", required: false },

  // Recover
  tierQ("RC01", "Recover", "Disaster recovery plan documented + tested"),
  tierQ("RC02", "Recover", "Lessons-learned process post-incident"),
  tierQ("RC03", "Recover", "Business continuity priorities + alternate-site plan"),
  { id: "RC99", section: "Recover", prompt: "Evidence / notes for Recover", type: "text", required: false },

  // Target tier (the customer's aspiration)
  { id: "TG01", section: "Target", prompt: "Target tier the customer wants to reach", type: "single_select", required: true, options: tierOptions },
];

export const NIST_CSF_BANK: DiscoveryBank = {
  kind: "NIST_CSF",
  questions: NIST_CSF_QUESTIONS,
};

export const NIST_CSF_FUNCTIONS = ["Govern", "Identify", "Protect", "Detect", "Respond", "Recover"] as const;

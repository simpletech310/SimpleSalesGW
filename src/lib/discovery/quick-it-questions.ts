import type { DiscoveryBank, DiscoveryQuestion } from "./types";

/**
 * v3.8 — Quick IT assessment (~20 Q triage).
 * A fast first pass the vCIO runs on-site to size the environment and surface
 * the biggest risks (no MFA, no backup, EOL gear, no EDR) in ~10 minutes.
 * Feeds `quick-it.ts` scoring → findings/risks/recommendedActions.
 */

function single(id: string, section: string, prompt: string, options: ReadonlyArray<{ value: string; label: string; weight?: number }>, required = false): DiscoveryQuestion {
  return { id, section, prompt, type: "single_select", required, options };
}
function multi(id: string, section: string, prompt: string, options: ReadonlyArray<{ value: string; label: string }>, required = false): DiscoveryQuestion {
  return { id, section, prompt, type: "multi_select", required, options };
}
function text(id: string, section: string, prompt: string, helpText?: string, required = false): DiscoveryQuestion {
  return { id, section, prompt, helpText, type: "text", required };
}
function num(id: string, section: string, prompt: string, required = false): DiscoveryQuestion {
  return { id, section, prompt, type: "numeric", required };
}

export const QUICK_IT_QUESTIONS: ReadonlyArray<DiscoveryQuestion> = [
  // Organization snapshot
  num("QIT01", "Snapshot", "How many employees / staff total?", true),
  num("QIT02", "Snapshot", "How many physical sites / offices?"),
  text("QIT03", "Snapshot", "Primary line of business / what they do"),

  // Endpoints
  num("QIT04", "Endpoints", "Approx. number of workstations / laptops?", true),
  single("QIT05", "Endpoints", "Typical age of the fleet?", [
    { value: "lt2", label: "Mostly under 2 years" },
    { value: "2to4", label: "2–4 years" },
    { value: "gt4", label: "Mostly 4+ years" },
    { value: "mixed", label: "Mixed / unknown" },
  ]),
  multi("QIT06", "Endpoints", "Operating systems in use", [
    { value: "win11", label: "Windows 11" },
    { value: "win10", label: "Windows 10" },
    { value: "win_old", label: "Windows 8/7 or older" },
    { value: "macos", label: "macOS" },
    { value: "linux", label: "Linux" },
  ]),

  // Servers / cloud
  single("QIT07", "Servers & cloud", "Where do core apps / files live?", [
    { value: "cloud", label: "Cloud / SaaS only" },
    { value: "hybrid", label: "Hybrid (some on-prem servers)" },
    { value: "onprem", label: "Mostly on-prem servers" },
  ]),
  num("QIT08", "Servers & cloud", "How many physical/virtual servers on-site?"),
  text("QIT09", "Servers & cloud", "Key line-of-business applications"),

  // Identity
  single("QIT10", "Identity", "Primary identity / email platform", [
    { value: "m365", label: "Microsoft 365 / Entra" },
    { value: "google", label: "Google Workspace" },
    { value: "onprem_ad", label: "On-prem Active Directory only" },
    { value: "mixed", label: "Mixed" },
    { value: "none", label: "None / consumer email" },
  ], true),
  single("QIT11", "Identity", "Is MFA enforced for all users?", [
    { value: "all", label: "Yes — enforced for everyone", weight: 2 },
    { value: "some", label: "Partial / admins only", weight: 1 },
    { value: "none", label: "No MFA", weight: 0 },
    { value: "unknown", label: "Unknown", weight: 0 },
  ], true),

  // Security
  single("QIT12", "Security", "Endpoint protection in place?", [
    { value: "edr", label: "Managed EDR / XDR", weight: 2 },
    { value: "av", label: "Basic antivirus only", weight: 1 },
    { value: "none", label: "None / built-in only", weight: 0 },
    { value: "unknown", label: "Unknown", weight: 0 },
  ], true),
  single("QIT13", "Security", "How is patching handled?", [
    { value: "managed", label: "Centrally managed / automated", weight: 2 },
    { value: "manual", label: "Manual / ad-hoc", weight: 1 },
    { value: "none", label: "Not done", weight: 0 },
    { value: "unknown", label: "Unknown", weight: 0 },
  ]),
  single("QIT14", "Security", "Security awareness training for staff?", [
    { value: "yes", label: "Yes — ongoing" },
    { value: "once", label: "One-time / occasional" },
    { value: "no", label: "No" },
  ]),

  // Backup / continuity
  single("QIT15", "Backup & continuity", "Backup posture?", [
    { value: "managed_tested", label: "Managed + tested restores", weight: 2 },
    { value: "exists", label: "Backups exist but untested", weight: 1 },
    { value: "none", label: "No backups", weight: 0 },
    { value: "unknown", label: "Unknown", weight: 0 },
  ], true),
  single("QIT16", "Backup & continuity", "Any business continuity / DR plan?", [
    { value: "documented", label: "Documented + tested" },
    { value: "informal", label: "Informal" },
    { value: "none", label: "None" },
  ]),

  // Current support model
  single("QIT17", "Support", "Who supports IT today?", [
    { value: "current_msp", label: "Another MSP" },
    { value: "internal", label: "Internal staff / IT person" },
    { value: "break_fix", label: "Break-fix / as-needed" },
    { value: "nobody", label: "Nobody / whoever's around" },
  ]),
  text("QIT18", "Support", "Current MSP / IT provider (if any) + satisfaction"),

  // Pains
  multi("QIT19", "Pain points", "Top pain points driving this conversation", [
    { value: "downtime", label: "Downtime / reliability" },
    { value: "security", label: "Security / compliance worry" },
    { value: "slow", label: "Slow response from current support" },
    { value: "cost", label: "Cost / unpredictable bills" },
    { value: "growth", label: "Growth / scaling" },
    { value: "cloud", label: "Cloud migration" },
  ]),
  text("QIT20", "Pain points", "Anything else the vCIO should flag for the quote"),
];

export const QUICK_IT_BANK: DiscoveryBank = {
  kind: "QUICK_IT",
  questions: QUICK_IT_QUESTIONS,
};

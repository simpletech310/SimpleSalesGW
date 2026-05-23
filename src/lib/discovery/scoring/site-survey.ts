/**
 * Site Survey scoring — no numeric scorecard.
 * Produces a structured Findings + Risks summary derived from answers across
 * the expanded ~120-question template.
 */

export type SiteSurveyScorecard = {
  kind: "SITE_SURVEY";
  summary: string;
  findings: string[];
  risks: Array<{ severity: "high" | "medium" | "low"; description: string }>;
  recommendedActions: string[];
  /** Coverage % — how many questions had non-empty answers. */
  coveragePct: number;
};

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function asArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function asBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "object" && v && "value" in v) {
    const inner = (v as Record<string, unknown>).value;
    return typeof inner === "boolean" ? inner : undefined;
  }
  return undefined;
}
function asNumber(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function scoreSiteSurvey(answers: Record<string, unknown>): SiteSurveyScorecard {
  const findings: string[] = [];
  const risks: SiteSurveyScorecard["risks"] = [];
  const actions: string[] = [];

  const totalQuestions = 120;
  let answered = 0;
  for (const v of Object.values(answers)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    answered++;
  }
  const coveragePct = Math.min(100, Math.round((answered / totalQuestions) * 100));

  // Profile + sites
  const sites = asNumber(answers["SP01"]);
  if (sites && sites > 1) findings.push(`Multi-site operation (${sites} locations).`);
  const itModel = asString(answers["CP10"]);
  if (itModel === "none" || itModel === "informal") {
    risks.push({ severity: "high", description: "No dedicated IT support — first priority is establishing a managed baseline." });
    actions.push("Deploy managed-IT baseline (RMM + EDR + identity + backup) in week 1 of ONBOARD.");
  } else if (itModel === "single_person") {
    risks.push({ severity: "medium", description: "Bus factor: single IT person — knowledge transfer + documentation are at risk." });
    actions.push("Capture critical IT documentation in ITGlue/Hudu and cross-train Gateway team.");
  }

  // Compliance
  const regs = asArray(answers["CF01"]).filter((r) => r !== "NONE");
  if (regs.length > 0) {
    findings.push(`Active regulatory drivers: ${regs.join(", ")}.`);
    actions.push("Cross-check NIST CSF gaps against the active regulations.");
    if (regs.includes("CMMC")) {
      actions.push("Run the NIST 800-171 Supplemental discovery for CMMC readiness scoring.");
    }
  }
  if (asBool(answers["CF02"]) === true) findings.push("Carries cyber insurance — renewal date drives the cybersecurity baseline.");
  if (asBool(answers["CF05"]) === true) findings.push("Recent third-party security questionnaire — formal NIST baseline recommended.");

  // Identity
  const mfa = asString(answers["ID02"]);
  if (mfa === "none") {
    risks.push({ severity: "high", description: "No MFA in place." });
    actions.push("Roll out MFA to all admin accounts in week 1; full coverage by end of ONBOARD.");
  } else if (mfa === "few" || mfa === "admins_only") {
    risks.push({ severity: "medium", description: "MFA coverage is limited." });
    actions.push("Extend MFA to all users.");
  }
  if (asBool(answers["CL06"]) === false) {
    risks.push({ severity: "high", description: "Legacy authentication not disabled — wide phishing/credential-stuffing exposure." });
    actions.push("Disable legacy auth in M365/Entra (or equivalent).");
  }

  // Endpoints / RMM
  const rmm = asString(answers["EP01"]);
  if (!rmm || rmm.toLowerCase().includes("none") || rmm.toLowerCase().includes("no")) {
    risks.push({ severity: "high", description: "No endpoint management / RMM in place." });
    actions.push("Deploy RMM agent and confirm 100% coverage.");
  }
  if (asBool(answers["EP04"]) === false) {
    risks.push({ severity: "medium", description: "Disk encryption not enforced." });
    actions.push("Roll out BitLocker / FileVault per device policy.");
  }

  // Backups
  const restore = asString(answers["BK04"]);
  if (restore === "never" || restore === "unsure") {
    risks.push({ severity: "high", description: "Restore test has never been verified — backups may be a paper tiger." });
    actions.push("Run a documented restore test in week 1 of ONBOARD.");
  } else if (restore === "lt_365") {
    risks.push({ severity: "medium", description: "Restore test more than 90 days old." });
    actions.push("Schedule monthly restore tests.");
  }
  if (asBool(answers["BK07"]) === false) {
    risks.push({ severity: "medium", description: "No immutable / offsite backup copies — ransomware exposure." });
    actions.push("Add immutable/offsite backup tier.");
  }

  // Security stack
  if (!asString(answers["SS01"])) {
    risks.push({ severity: "high", description: "No EDR/AV documented." });
    actions.push("Deploy EDR across the fleet during ONBOARD.");
  }
  if (!asString(answers["SS03"])) {
    risks.push({ severity: "medium", description: "No DNS / web filtering — high phishing exposure." });
    actions.push("Deploy DNS filtering (Cisco Umbrella / DNSFilter / Cloudflare Gateway).");
  }
  if (!asString(answers["SS06"])) {
    risks.push({ severity: "medium", description: "No SIEM / log aggregation — weak detection capability." });
    actions.push("Add SIEM with managed monitoring.");
  }
  if (!asString(answers["SS09"])) {
    risks.push({ severity: "low", description: "No recent penetration test on record." });
    actions.push("Schedule pen test as part of annual security cadence.");
  }

  // WAN
  if (asBool(answers["WAN04"]) === false) {
    risks.push({ severity: "medium", description: "No WAN failover — single point of internet failure." });
    actions.push("Evaluate redundant WAN or LTE/5G failover.");
  }

  // Servers
  if (asBool(answers["SV06"]) === true) {
    risks.push({ severity: "high", description: "Servers running EOL operating systems." });
    actions.push("Plan server OS upgrade or migration off-prem.");
  }

  // Stakeholders
  if (!asString(answers["ST01"])) {
    risks.push({ severity: "medium", description: "Executive sponsor not yet named on the survey." });
    actions.push("Confirm executive sponsor before client readout.");
  }

  // Identity governance
  if (asBool(answers["ID05"]) === false) {
    risks.push({ severity: "medium", description: "No documented joiner / mover / leaver (JML) process." });
    actions.push("Document JML; tie to identity provider workflows.");
  }
  if (asBool(answers["ID03"]) === false) {
    risks.push({ severity: "low", description: "No privileged-account review cadence." });
    actions.push("Establish quarterly privileged-account review.");
  }

  const summary = sites && sites > 1
    ? `${sites}-site operation${regs.length > 0 ? ` with ${regs.length} active regulation(s)` : ""} and ${risks.length} surfaced risk${risks.length === 1 ? "" : "s"}.`
    : `Single-site operation${regs.length > 0 ? ` with ${regs.length} active regulation(s)` : ""} and ${risks.length} surfaced risk${risks.length === 1 ? "" : "s"}.`;

  return {
    kind: "SITE_SURVEY",
    summary,
    findings,
    risks,
    recommendedActions: actions,
    coveragePct,
  };
}

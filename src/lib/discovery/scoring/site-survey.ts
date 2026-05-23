/**
 * Site Survey scoring — no numeric scorecard.
 * Produces a structured Findings + Risks summary derived from the answers.
 */

export type SiteSurveyScorecard = {
  kind: "SITE_SURVEY";
  summary: string;
  findings: string[];
  risks: Array<{ severity: "high" | "medium" | "low"; description: string }>;
  recommendedActions: string[];
};

function answerString(answers: Record<string, unknown>, id: string): string | undefined {
  const v = answers[id];
  return typeof v === "string" ? v : undefined;
}

function answerArray(answers: Record<string, unknown>, id: string): string[] {
  const v = answers[id];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function answerNumber(answers: Record<string, unknown>, id: string): number | undefined {
  const v = answers[id];
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function answerBool(answers: Record<string, unknown>, id: string): boolean | undefined {
  const v = answers[id];
  if (typeof v === "boolean") return v;
  if (typeof v === "object" && v && "value" in v) {
    const inner = (v as Record<string, unknown>).value;
    return typeof inner === "boolean" ? inner : undefined;
  }
  return undefined;
}

export function scoreSiteSurvey(answers: Record<string, unknown>): SiteSurveyScorecard {
  const findings: string[] = [];
  const risks: SiteSurveyScorecard["risks"] = [];
  const actions: string[] = [];

  // Connectivity
  const sites = answerNumber(answers, "SS01");
  if (sites && sites > 1) findings.push(`Multi-site operation (${sites} locations).`);
  if (answerBool(answers, "SS03") === false) {
    risks.push({ severity: "medium", description: "No WAN failover — single point of internet failure." });
    actions.push("Evaluate redundant WAN or LTE/5G failover.");
  }

  // Identity
  const mfa = answerString(answers, "SS07");
  if (mfa === "none") {
    risks.push({ severity: "high", description: "No MFA in place." });
    actions.push("Roll out MFA — start with all admin accounts in week 1.");
  } else if (mfa === "few" || mfa === "admins_only") {
    risks.push({ severity: "medium", description: "MFA coverage is limited." });
    actions.push("Extend MFA to all users.");
  }

  // Endpoints / RMM
  const rmm = answerString(answers, "SS09");
  if (rmm === "no" || rmm === "unsure") {
    risks.push({ severity: "high", description: "No endpoint management / RMM in place." });
    actions.push("Deploy RMM agent and confirm 100% coverage.");
  } else if (rmm === "yes_unmanaged") {
    risks.push({ severity: "medium", description: "RMM installed but not actively managed." });
    actions.push("Take over RMM monitoring and patch policy.");
  }

  // Backups
  const restore = answerString(answers, "SS16");
  if (restore === "never" || restore === "unsure") {
    risks.push({ severity: "high", description: "Restore test has never been verified — backups may be a paper tiger." });
    actions.push("Run a documented restore test in week 1 of ONBOARD.");
  } else if (restore === "lt_365") {
    risks.push({ severity: "medium", description: "Restore test more than 90 days old." });
    actions.push("Schedule monthly restore tests.");
  }

  // Security stack
  if (answerBool(answers, "SS20") === false) {
    risks.push({ severity: "medium", description: "No DNS / web filter — high phishing exposure." });
    actions.push("Deploy DNS filtering (e.g. Cisco Umbrella or DNSFilter).");
  }
  const siem = answerString(answers, "SS22");
  if (siem === "no" || siem === "unsure") {
    risks.push({ severity: "medium", description: "No SIEM / log aggregation; weak detection capability." });
    actions.push("Add SIEM with managed monitoring.");
  }
  const irp = answerString(answers, "SS23");
  if (irp === "no" || irp === "unsure") {
    risks.push({ severity: "high", description: "No incident response plan." });
    actions.push("Draft + tabletop-test an incident response plan.");
  } else if (irp === "documented") {
    actions.push("Tabletop-test the existing IR plan.");
  }

  // Compliance
  const regs = answerArray(answers, "SS24").filter((r) => r !== "NONE");
  if (regs.length > 0) {
    findings.push(`Active compliance drivers: ${regs.join(", ")}.`);
    actions.push("Cross-check NIST CSF gaps against the active regulations.");
  }

  // Stakeholders
  const sponsor = answerString(answers, "SS28");
  if (!sponsor) {
    risks.push({ severity: "medium", description: "Executive sponsor not yet named on the survey." });
    actions.push("Confirm executive sponsor before client readout.");
  }

  const summary = sites && sites > 1
    ? `${sites}-site operation with ${regs.length > 0 ? regs.length + " active regulation(s)" : "no regulatory pressure"} and ${risks.length} surfaced risk${risks.length === 1 ? "" : "s"}.`
    : `Single-site operation with ${risks.length} surfaced risk${risks.length === 1 ? "" : "s"}.`;

  return { kind: "SITE_SURVEY", summary, findings, risks, recommendedActions: actions };
}

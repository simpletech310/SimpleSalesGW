/**
 * v3.8 — Quick IT assessment scoring.
 * Turns the ~20-Q triage into findings, gap-driven risks, and next steps.
 * Advisory only (no recommendedLineItems).
 */

export type QuickItScorecard = {
  kind: "QUICK_IT";
  summary: string;
  findings: string[];
  risks: Array<{ severity: "high" | "medium" | "low"; description: string }>;
  recommendedActions: string[];
  recommendedLineItems: never[];
  coveragePct: number;
};

function asNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return 0;
}
function asArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}
function coverage(answers: Record<string, unknown>, total: number): number {
  const filled = Object.values(answers).filter(
    (v) => v !== "" && v != null && !(Array.isArray(v) && v.length === 0),
  ).length;
  return Math.min(100, Math.round((filled / total) * 100));
}

export function scoreQuickIt(answers: Record<string, unknown>): QuickItScorecard {
  const findings: string[] = [];
  const risks: QuickItScorecard["risks"] = [];
  const recommendedActions: string[] = [];

  const employees = asNum(answers.QIT01);
  const endpoints = asNum(answers.QIT04);
  const sites = asNum(answers.QIT02);
  if (employees > 0) findings.push(`${employees} staff${sites > 0 ? ` across ${sites} site(s)` : ""}.`);
  if (endpoints > 0) findings.push(`~${endpoints} workstations/laptops.`);

  const os = asArr(answers.QIT06);
  if (os.includes("win_old")) {
    risks.push({ severity: "high", description: "End-of-life Windows (8/7 or older) still in use — unsupported and a security exposure." });
    recommendedActions.push("Inventory and replace/upgrade end-of-life Windows devices.");
  }

  const identity = String(answers.QIT10 ?? "");
  if (identity === "none") {
    risks.push({ severity: "high", description: "No managed identity platform — no central control over accounts." });
    recommendedActions.push("Stand up Microsoft 365 / Entra or Google Workspace for managed identity.");
  }

  const mfa = String(answers.QIT11 ?? "");
  if (mfa === "none" || mfa === "unknown") {
    risks.push({ severity: "high", description: "MFA not enforced — the single biggest account-takeover risk." });
    recommendedActions.push("Enforce MFA on email, VPN, and admin accounts immediately.");
  } else if (mfa === "some") {
    risks.push({ severity: "medium", description: "MFA only partially deployed." });
    recommendedActions.push("Extend MFA enforcement to all users.");
  }

  const edr = String(answers.QIT12 ?? "");
  if (edr === "none" || edr === "unknown") {
    risks.push({ severity: "high", description: "No managed endpoint protection / EDR." });
    recommendedActions.push("Deploy managed EDR across all endpoints.");
  } else if (edr === "av") {
    risks.push({ severity: "medium", description: "Basic antivirus only — no detection/response." });
    recommendedActions.push("Upgrade legacy AV to managed EDR/XDR.");
  }

  const patch = String(answers.QIT13 ?? "");
  if (patch === "none" || patch === "unknown") {
    risks.push({ severity: "medium", description: "Patching is unmanaged." });
    recommendedActions.push("Implement centralized, automated patch management.");
  }

  const backup = String(answers.QIT15 ?? "");
  if (backup === "none" || backup === "unknown") {
    risks.push({ severity: "high", description: "No verified backups — unrecoverable from ransomware or failure." });
    recommendedActions.push("Implement managed backup with tested restores (3-2-1).");
  } else if (backup === "exists") {
    risks.push({ severity: "medium", description: "Backups exist but restores are untested." });
    recommendedActions.push("Run and document a test restore.");
  }

  const support = String(answers.QIT17 ?? "");
  if (support === "nobody" || support === "break_fix") {
    findings.push("No proactive IT support model in place today.");
  }
  const pains = asArr(answers.QIT19);
  if (pains.length > 0) findings.push(`Stated pains: ${pains.join(", ")}.`);

  const coveragePct = coverage(answers, 20);
  const highRisks = risks.filter((r) => r.severity === "high").length;
  const summary =
    employees > 0
      ? `Quick IT triage for a ${employees}-person org — ${highRisks} high-risk gap${highRisks === 1 ? "" : "s"} flagged.`
      : "Quick IT triage — fill in headcount and endpoints to complete the snapshot.";

  return { kind: "QUICK_IT", summary, findings, risks, recommendedActions, recommendedLineItems: [], coveragePct };
}

/**
 * v3.8 — SOC 2 readiness interview scoring.
 * Aggregates the tier-weighted control answers into a readiness % + band,
 * flags critical missing controls as risks, and turns every gap into a
 * remediation next step. Advisory only.
 */

export type Soc2InterviewScorecard = {
  kind: "SOC2_INTERVIEW";
  summary: string;
  readinessPct: number;
  band: "Audit-ready" | "Close" | "Foundational gaps" | "Early";
  findings: string[];
  risks: Array<{ severity: "high" | "medium" | "low"; description: string }>;
  recommendedActions: string[];
  recommendedLineItems: never[];
  coveragePct: number;
};

const MATURITY: Record<string, number> = { yes: 2, partial: 1, no: 0, unknown: 0 };

// Critical controls: a "no"/"unknown" here is a named risk, not just a gap.
const CRITICAL: Array<{ id: string; severity: "high" | "medium"; label: string; action: string }> = [
  { id: "SOC10", severity: "high", label: "MFA not enforced on email/VPN/critical systems", action: "Enforce MFA across email, VPN, and admin access." },
  { id: "SOC33", severity: "high", label: "Backups not performed or restores untested", action: "Implement managed backups with documented test restores." },
  { id: "SOC23", severity: "high", label: "No documented incident response plan", action: "Write and approve an incident response plan." },
  { id: "SOC26", severity: "high", label: "Data not encrypted in transit and at rest", action: "Enforce TLS in transit and encryption at rest." },
  { id: "SOC05", severity: "medium", label: "Security policies not documented/reviewed", action: "Document and annually review information security policies." },
  { id: "SOC19", severity: "medium", label: "No centralized logging / SIEM", action: "Centralize logging and alerting for critical systems." },
  { id: "SOC11", severity: "medium", label: "No periodic access reviews", action: "Establish a recurring access-review cadence." },
  { id: "SOC34", severity: "medium", label: "No documented BCP/DR plan", action: "Document a business continuity / disaster recovery plan." },
];

function coverage(answers: Record<string, unknown>, total: number): number {
  const filled = Object.values(answers).filter(
    (v) => v !== "" && v != null && !(Array.isArray(v) && v.length === 0),
  ).length;
  return Math.min(100, Math.round((filled / total) * 100));
}

export function scoreSoc2Interview(answers: Record<string, unknown>): Soc2InterviewScorecard {
  const findings: string[] = [];
  const risks: Soc2InterviewScorecard["risks"] = [];
  const recommendedActions: string[] = [];

  // Aggregate maturity across answered tier controls (value is one of MATURITY).
  let earned = 0;
  let possible = 0;
  let gaps = 0;
  for (const v of Object.values(answers)) {
    if (typeof v === "string" && v in MATURITY) {
      earned += MATURITY[v];
      possible += 2;
      if (v === "no" || v === "unknown" || v === "partial") gaps += 1;
    }
  }
  // SOC36 evidence readiness (automated/manual/none).
  const ev = String(answers.SOC36 ?? "");
  if (ev) {
    possible += 2;
    earned += ev === "automated" ? 2 : ev === "manual" ? 1 : 0;
    if (ev === "none") {
      risks.push({ severity: "medium", description: "No evidence trail — audit collection will be manual and slow." });
      recommendedActions.push("Stand up compliance/evidence tooling to automate control evidence.");
    }
  }

  const readinessPct = possible > 0 ? Math.round((earned / possible) * 100) : 0;
  const band: Soc2InterviewScorecard["band"] =
    readinessPct >= 85 ? "Audit-ready"
    : readinessPct >= 65 ? "Close"
    : readinessPct >= 40 ? "Foundational gaps"
    : "Early";

  // Scope finding
  const scope = Array.isArray(answers.SOC01) ? (answers.SOC01 as string[]) : [];
  if (scope.length > 0) findings.push(`In-scope criteria: ${scope.join(", ")}.`);
  const auditType = String(answers.SOC02 ?? "");
  if (auditType === "type1" || auditType === "type2") findings.push(`Target: SOC 2 ${auditType === "type1" ? "Type I" : "Type II"}.`);
  if (String(answers.SOC03) === "no") findings.push("First-time audit — no prior attestation.");

  // Named critical-control risks
  for (const c of CRITICAL) {
    const val = String(answers[c.id] ?? "");
    if (val === "no" || val === "unknown") {
      risks.push({ severity: c.severity, description: c.label + "." });
      recommendedActions.push(c.action);
    }
  }

  findings.push(`Control maturity ${readinessPct}% (${band}).`);
  if (gaps > 0) findings.push(`${gaps} control(s) answered partial / not-in-place.`);

  const coveragePct = coverage(answers, 38);
  const summary = `SOC 2 readiness ${readinessPct}% — ${band}. ${risks.filter((r) => r.severity === "high").length} critical gap(s).`;

  return {
    kind: "SOC2_INTERVIEW",
    summary,
    readinessPct,
    band,
    findings,
    risks,
    recommendedActions,
    recommendedLineItems: [],
    coveragePct,
  };
}

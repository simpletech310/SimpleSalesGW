/**
 * v3.8 — Network assessment scoring.
 * Gap-driven risks (EOL firewall, no failover, flat network, no docs) +
 * next steps. Advisory only.
 */

export type NetworkScorecard = {
  kind: "NETWORK";
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

export function scoreNetwork(answers: Record<string, unknown>): NetworkScorecard {
  const findings: string[] = [];
  const risks: NetworkScorecard["risks"] = [];
  const recommendedActions: string[] = [];

  const sites = asNum(answers.NET01);
  const fw = String(answers.NET07 ?? "").trim();
  if (sites > 0) findings.push(`${sites} site(s) in scope.`);
  if (fw) findings.push(`Firewall: ${fw}.`);

  const down = asNum(answers.NET03);
  const up = asNum(answers.NET04);
  if (down > 0) findings.push(`Bandwidth ~${down}↓ / ${up}↑ Mbps.`);

  if (String(answers.NET05) === "none") {
    risks.push({ severity: "medium", description: "Single internet circuit — no failover. Outage = full downtime." });
    recommendedActions.push("Add a secondary circuit with automatic failover.");
  }

  const fwAge = String(answers.NET08 ?? "");
  if (fwAge === "gt5" || fwAge === "unknown") {
    risks.push({ severity: "high", description: "Firewall is 5+ years / EOL or unknown age — likely unsupported." });
    recommendedActions.push("Replace the edge firewall with a current, supported model.");
  }
  const fwLic = String(answers.NET09 ?? "");
  if (fwLic === "expired" || fwLic === "none" || fwLic === "unknown") {
    risks.push({ severity: "high", description: "No active UTM/security subscription on the firewall." });
    recommendedActions.push("License and enable firewall security services (IPS, GAV, web filtering).");
  }

  const seg = String(answers.NET15 ?? "");
  if (seg === "flat" || seg === "unknown") {
    risks.push({ severity: "medium", description: "Flat network — no VLAN segmentation. Lateral movement risk." });
    recommendedActions.push("Segment the network (guest, voice, IoT, servers) with VLANs.");
  }

  const sw = String(answers.NET12 ?? "");
  if (sw === "unmanaged") {
    risks.push({ severity: "medium", description: "Unmanaged switches — no visibility, VLANs, or QoS." });
    recommendedActions.push("Replace unmanaged switches with managed equivalents.");
  }

  const mon = String(answers.NET21 ?? "");
  if (mon === "none") {
    risks.push({ severity: "medium", description: "Network is not monitored — failures found reactively." });
    recommendedActions.push("Add RMM/SNMP monitoring on edge + switches.");
  }
  const docs = String(answers.NET22 ?? "");
  if (docs === "none") {
    risks.push({ severity: "low", description: "No network documentation." });
    recommendedActions.push("Produce a current network diagram + IP address management record.");
  }

  const issues = asArr(answers.NET25);
  if (issues.length > 0 && !issues.includes("none")) {
    findings.push(`Reported issues: ${issues.join(", ")}.`);
  }

  const coveragePct = coverage(answers, 30);
  const highRisks = risks.filter((r) => r.severity === "high").length;
  const summary = fw
    ? `Network review${sites > 0 ? ` (${sites} site(s))` : ""} — ${highRisks} high-risk gap${highRisks === 1 ? "" : "s"} flagged.`
    : "Network review — capture firewall + circuit details to complete.";

  return { kind: "NETWORK", summary, findings, risks, recommendedActions, recommendedLineItems: [], coveragePct };
}

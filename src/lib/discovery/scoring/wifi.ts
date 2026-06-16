/**
 * v3.8 — Wi-Fi assessment scoring.
 * Coverage/capacity/security gaps + next steps (site survey, AP refresh,
 * guest isolation). Advisory only.
 */

export type WifiScorecard = {
  kind: "WIFI";
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
function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === "yes";
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

export function scoreWifi(answers: Record<string, unknown>): WifiScorecard {
  const findings: string[] = [];
  const risks: WifiScorecard["risks"] = [];
  const recommendedActions: string[] = [];

  const sqft = asNum(answers.WIFI01);
  const aps = asNum(answers.WIFI05);
  const clients = asNum(answers.WIFI14);
  if (sqft > 0) findings.push(`~${sqft.toLocaleString()} sq ft to cover.`);
  if (aps > 0) findings.push(`${aps} access point(s) today.`);

  // Rough capacity heuristic: ~3,000 sq ft per AP for typical office density.
  if (sqft > 0 && aps > 0 && sqft / aps > 3500) {
    risks.push({ severity: "medium", description: `Low AP density (~${Math.round(sqft / aps).toLocaleString()} sq ft/AP) — likely coverage gaps.` });
    recommendedActions.push("Add access points and run a wireless survey to validate coverage.");
  }

  const apAge = String(answers.WIFI07 ?? "");
  const std = String(answers.WIFI08 ?? "");
  if (apAge === "gt5" || std === "older") {
    risks.push({ severity: "medium", description: "Aging APs / pre-Wi-Fi 5 hardware — capacity and reliability limits." });
    recommendedActions.push("Plan an AP refresh to Wi-Fi 6/6E.");
  }

  const mgmt = String(answers.WIFI09 ?? "");
  if (mgmt === "standalone" || mgmt === "unknown") {
    risks.push({ severity: "low", description: "APs are standalone / unmanaged — no central tuning or visibility." });
    recommendedActions.push("Move to cloud/controller-managed wireless.");
  }

  const auth = String(answers.WIFI11 ?? "");
  if (auth === "open" || auth === "unknown") {
    risks.push({ severity: "high", description: "Corporate Wi-Fi is open or weakly secured." });
    recommendedActions.push("Secure corporate SSID with WPA2/3 (ideally 802.1X/RADIUS).");
  }
  const guestIso = String(answers.WIFI12 ?? "");
  if (guestIso === "no" || guestIso === "unknown") {
    risks.push({ severity: "medium", description: "Guest traffic is not isolated from the LAN." });
    recommendedActions.push("Isolate guest Wi-Fi on its own VLAN with client isolation.");
  }

  const backhaul = String(answers.WIFI18 ?? "");
  if (backhaul === "mesh") {
    risks.push({ severity: "medium", description: "Wireless mesh backhaul — throughput and roaming penalties." });
    recommendedActions.push("Wire APs with PoE where possible.");
  }
  if (asBool(answers.WIFI16) || asBool(answers.WIFI17)) {
    findings.push("Voice/video or seamless roaming required — needs proper RF design.");
  }

  const issues = asArr(answers.WIFI20);
  if (issues.includes("deadspots")) {
    risks.push({ severity: "medium", description: "Reported dead spots / no-coverage areas." });
  }
  if (issues.length > 0 && !issues.includes("none")) findings.push(`Reported issues: ${issues.join(", ")}.`);

  if (!asBool(answers.WIFI22)) {
    recommendedActions.push("Perform a predictive or on-site wireless site survey before quoting.");
  }

  const coveragePct = coverage(answers, 25);
  const summary = aps > 0 || sqft > 0
    ? `Wi-Fi review${sqft > 0 ? ` (~${sqft.toLocaleString()} sq ft)` : ""} — ${risks.length} issue${risks.length === 1 ? "" : "s"} flagged.`
    : "Wi-Fi review — capture footprint + AP details to complete.";

  return { kind: "WIFI", summary, findings, risks, recommendedActions, recommendedLineItems: [], coveragePct };
}

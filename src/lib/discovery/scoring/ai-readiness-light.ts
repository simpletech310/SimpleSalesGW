/**
 * v3.8 — AI Readiness (Light) scoring.
 * Aggregates tier-weighted maturity answers into a readiness % + band, flags
 * governance/shadow-AI risks, and emits next steps. Advisory only.
 */

export type AiReadinessLightScorecard = {
  kind: "AI_READINESS_LIGHT";
  summary: string;
  readinessPct: number;
  band: "Leading" | "Progressing" | "Emerging" | "Nascent";
  findings: string[];
  risks: Array<{ severity: "high" | "medium" | "low"; description: string }>;
  recommendedActions: string[];
  recommendedLineItems: never[];
  coveragePct: number;
};

function asArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}
function tierWeight(v: unknown): number | null {
  if (typeof v === "string") {
    const m = /^tier_([0-4])$/.exec(v);
    if (m) return Number(m[1]);
  }
  return null;
}
function coverage(answers: Record<string, unknown>, total: number): number {
  const filled = Object.values(answers).filter(
    (v) => v !== "" && v != null && !(Array.isArray(v) && v.length === 0),
  ).length;
  return Math.min(100, Math.round((filled / total) * 100));
}

export function scoreAiReadinessLight(answers: Record<string, unknown>): AiReadinessLightScorecard {
  const findings: string[] = [];
  const risks: AiReadinessLightScorecard["risks"] = [];
  const recommendedActions: string[] = [];

  // Aggregate maturity across answered tier questions (0–4 each).
  let earned = 0;
  let possible = 0;
  for (const v of Object.values(answers)) {
    const w = tierWeight(v);
    if (w != null) {
      earned += w;
      possible += 4;
    }
  }
  const readinessPct = possible > 0 ? Math.round((earned / possible) * 100) : 0;
  const band: AiReadinessLightScorecard["band"] =
    readinessPct >= 75 ? "Leading"
    : readinessPct >= 50 ? "Progressing"
    : readinessPct >= 25 ? "Emerging"
    : "Nascent";

  // Current usage
  const tools = asArr(answers.AIL04).filter((t) => t !== "none");
  if (tools.length > 0) findings.push(`AI tools in use: ${tools.join(", ")}.`);
  const usage = String(answers.AIL05 ?? "");
  if (usage === "shadow") {
    risks.push({ severity: "high", description: "Mostly shadow AI usage — ungoverned data exposure risk." });
    recommendedActions.push("Sanction approved AI tools and publish guidance to replace shadow usage.");
  }

  // Governance
  const aup = tierWeight(answers.AIL09);
  if (aup != null && aup <= 1) {
    risks.push({ severity: "medium", description: "No / ad-hoc AI acceptable-use policy." });
    recommendedActions.push("Draft and roll out an AI acceptable-use policy.");
  }
  const reg = String(answers.AIL11 ?? "");
  const privacyAware = tierWeight(answers.AIL10);
  if (reg === "high" && privacyAware != null && privacyAware <= 1) {
    risks.push({ severity: "high", description: "High regulatory exposure but low AI privacy/IP risk awareness." });
    recommendedActions.push("Run an AI risk + data-privacy review before broad adoption.");
  }

  // Foundation
  const foundation = tierWeight(answers.AIL17);
  if (foundation != null && foundation <= 1) {
    risks.push({ severity: "medium", description: "Weak IT foundation (identity/security) to support AI safely." });
    recommendedActions.push("Shore up identity + endpoint security before scaling AI.");
  }

  // Use-cases
  const useCases = asArr(answers.AIL14);
  if (useCases.length > 0) findings.push(`Interest areas: ${useCases.join(", ")}.`);
  const copilot = String(answers.AIL16 ?? "");
  if (copilot === "yes") recommendedActions.push("Pilot Microsoft Copilot with the highest-interest team.");

  findings.push(`AI readiness ${readinessPct}% (${band}).`);

  const coveragePct = coverage(answers, 18);
  const summary = `AI readiness ${readinessPct}% — ${band}.${risks.length ? ` ${risks.length} risk(s) flagged.` : ""}`;

  return {
    kind: "AI_READINESS_LIGHT",
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

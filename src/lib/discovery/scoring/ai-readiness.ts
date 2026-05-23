/**
 * AI Readiness scoring:
 *   - 8-dimension AI Maturity Scorecard (MS01..MS08), 0-4 each
 *   - Use-case matrix per department: Impact (1-4) × Feasibility (0-4) →
 *     prioritized list, top picks float to the quick-win bucket
 *   - 30/60/90 + 12-month rollout drawn from the answers
 */

import { AI_READINESS_QUESTIONS, AI_READINESS_DEPARTMENTS } from "../ai-readiness-questions";

export type AiReadinessScorecard = {
  kind: "AI_READINESS";
  overall: number;                  // 0-4 average across MS01..MS08
  dimensions: Array<{ id: string; label: string; score: number }>;
  governanceScore: number;          // 0-4 average across GV* weighted questions
  dataScore: number;                // 0-4 average across DR* weighted questions
  useCases: Array<{
    department: string;
    summary?: string;
    impactScore: number;             // 0-4
    feasibilityScore: number;        // 0-4
    priorityScore: number;           // impact * feasibility (0-16)
    blockers?: string;
  }>;
  topUseCases: AiReadinessScorecard["useCases"];
  highestValueProcess?: string;
  stalledInitiatives?: string;
  rollout: {
    days_0_30: string[];
    days_31_90: string[];
    days_91_365: string[];
  };
  /** Back-compat: roadmap renderer uses `pillars` shape. Mirror dimensions for now. */
  pillars: Array<{ name: string; score: number }>;
  /** Back-compat: previously exposed as a string[] of department names. */
  topUseCaseDepartments: string[];
};

function getStringWeight(qid: string, answers: Record<string, unknown>): number | null {
  const q = AI_READINESS_QUESTIONS.find((x) => x.id === qid);
  if (!q || !q.options) return null;
  const v = answers[qid];
  if (typeof v !== "string") return null;
  const opt = q.options.find((o) => o.value === v);
  return opt?.weight ?? null;
}

function avgWeights(qids: string[], answers: Record<string, unknown>): number {
  let sum = 0, count = 0;
  for (const id of qids) {
    const w = getStringWeight(id, answers);
    if (w !== null) { sum += w; count += 1; }
  }
  return count === 0 ? 0 : Math.round((sum / count) * 10) / 10;
}

const MS_LABELS: Record<string, string> = {
  MS01: "Strategy & vision",
  MS02: "Leadership & culture",
  MS03: "People & skills",
  MS04: "Data foundations",
  MS05: "Tooling & infrastructure",
  MS06: "Governance & ethics",
  MS07: "Operations",
  MS08: "Customer value",
};

export function scoreAiReadiness(answers: Record<string, unknown>): AiReadinessScorecard {
  const dimensions = Object.keys(MS_LABELS).map((id) => ({
    id,
    label: MS_LABELS[id]!,
    score: getStringWeight(id, answers) ?? 0,
  }));
  const overall = dimensions.length === 0
    ? 0
    : Math.round((dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length) * 10) / 10;

  const governanceScore = avgWeights(["GV01", "GV02", "GV03"], answers);
  const dataScore = avgWeights(["DR01", "DR02", "DR03"], answers);

  // Use-case matrix per department
  const useCases: AiReadinessScorecard["useCases"] = [];
  for (const dept of AI_READINESS_DEPARTMENTS) {
    const slug = dept.replace(/\s+/g, "").substring(0, 5).toUpperCase();
    const summary = typeof answers[`UC.${slug}.02`] === "string" ? (answers[`UC.${slug}.02`] as string) : undefined;
    const impactScore = getStringWeight(`UC.${slug}.05`, answers) ?? 0;
    const feasibilityScore = getStringWeight(`UC.${slug}.06`, answers) ?? 0;
    const blockers = typeof answers[`UC.${slug}.07`] === "string" ? (answers[`UC.${slug}.07`] as string) : undefined;
    if (summary || impactScore > 0 || feasibilityScore > 0) {
      useCases.push({
        department: dept,
        summary,
        impactScore,
        feasibilityScore,
        priorityScore: impactScore * feasibilityScore,
        blockers,
      });
    }
  }
  const topUseCases = [...useCases].sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 5);

  const highestValueProcess = typeof answers["EX04"] === "string" ? (answers["EX04"] as string) : undefined;
  const stalled = typeof answers["GV11"] === "string" && (answers["GV11"] as string).trim()
    ? (answers["GV11"] as string)
    : undefined;

  const rollout = {
    days_0_30: [
      overall < 2 ? "Publish AI acceptable-use policy" : "Inventory current AI tool usage (sanctioned + shadow)",
      ...topUseCases.slice(0, 2).map((u) => `Pilot quick win in ${u.department}: ${u.summary ?? "top automation"}`),
      stalled ? `Triage stalled initiative: ${stalled}` : "Identify 1-2 quick-win use cases",
    ],
    days_31_90: [
      "Roll out approved AI tool to first 1-2 departments",
      "Establish prompt library + monthly office hours",
      governanceScore < 2 ? "Stand up vendor-review + DLP policy" : "Document AI escalation + review process",
    ],
    days_91_365: [
      ...topUseCases.slice(2, 5).map((u) => `Expand to ${u.department}: ${u.summary ?? "scoped use case"}`),
      dataScore < 2 ? "Invest in data hygiene + classification before scaling" : "Introduce custom RAG / domain-specific AI",
      "Quarterly maturity re-assessment using this same scorecard",
    ],
  };

  const ex03 = typeof answers["EX03"] === "string" ? (answers["EX03"] as string) : "";
  if (ex03 && ex03.trim()) {
    rollout.days_0_30.unshift(`Address top pain identified by exec: ${ex03}`);
  }

  return {
    kind: "AI_READINESS",
    overall,
    dimensions,
    governanceScore,
    dataScore,
    useCases,
    topUseCases,
    highestValueProcess,
    stalledInitiatives: stalled,
    rollout,
    // back-compat
    pillars: dimensions.map((d) => ({ name: d.label, score: d.score })),
    topUseCaseDepartments: topUseCases.map((u) => u.department),
  };
}

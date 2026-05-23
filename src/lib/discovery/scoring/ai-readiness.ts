/**
 * AI Readiness scoring: average the option weights within each pillar to
 * produce a 0-4 maturity score per pillar plus overall.
 */

import { AI_READINESS_QUESTIONS } from "../ai-readiness-questions";

export type AiReadinessScorecard = {
  kind: "AI_READINESS";
  overall: number;        // 0-4 average
  pillars: Array<{ name: string; score: number; questions: number }>;
  topUseCases: string[];   // department picks from AI09
  highestValueProcess?: string;
  stalledInitiatives?: string;
  rollout: {
    days_0_30: string[];
    days_31_90: string[];
    days_91_365: string[];
  };
};

const PILLARS = ["Org Readiness", "Data Foundations", "Use Cases", "Governance"] as const;

export function scoreAiReadiness(answers: Record<string, unknown>): AiReadinessScorecard {
  const pillarScores: Array<{ name: string; score: number; questions: number }> = [];

  for (const pillar of PILLARS) {
    const qs = AI_READINESS_QUESTIONS.filter((q) => q.section === pillar && q.type === "single_select" && q.options);
    let sum = 0;
    let count = 0;
    for (const q of qs) {
      const v = answers[q.id];
      if (typeof v !== "string") continue;
      const opt = q.options!.find((o) => o.value === v);
      if (opt?.weight !== undefined) {
        sum += opt.weight;
        count += 1;
      }
    }
    const score = count === 0 ? 0 : Math.round((sum / count) * 10) / 10;
    pillarScores.push({ name: pillar, score, questions: count });
  }

  const overall = pillarScores.length === 0
    ? 0
    : Math.round((pillarScores.reduce((s, p) => s + p.score, 0) / pillarScores.length) * 10) / 10;

  const departments = Array.isArray(answers["AI09"])
    ? (answers["AI09"] as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  const highestValueProcess = typeof answers["AI10"] === "string" ? (answers["AI10"] as string) : undefined;
  const stalled = typeof answers["AI11"] === "string" && (answers["AI11"] as string).trim()
    ? (answers["AI11"] as string)
    : undefined;

  // Rollout buckets sequenced by typical Gateway pattern.
  const rollout = {
    days_0_30: [
      overall < 2 ? "Publish AI acceptable-use policy" : "Inventory current AI tool usage (sanctioned + shadow)",
      "Run a 60-minute workshop with one volunteer team on practical AI prompts",
      stalled ? `Triage stalled initiative: ${stalled}` : "Identify 1-2 quick-win use cases",
    ],
    days_31_90: [
      "Roll out approved AI tool to first department(s)",
      "Establish prompt library + monthly office hours",
      departments.includes("legal") ? "Bring legal/compliance into the governance loop" : "Document a vendor-review checklist",
    ],
    days_91_365: [
      "Expand to remaining departments based on measured ROI",
      "Introduce custom RAG / domain-specific AI where data foundations support it",
      "Quarterly maturity re-assessment using this same scorecard",
    ],
  };

  return {
    kind: "AI_READINESS",
    overall,
    pillars: pillarScores,
    topUseCases: departments,
    highestValueProcess,
    stalledInitiatives: stalled,
    rollout,
  };
}

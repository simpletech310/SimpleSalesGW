/**
 * NIST CSF scoring: average the tier weights within each Function to produce
 * a current Tier (1-4) per Function, plus an overall current vs. target Tier
 * gap and prioritized remediation items.
 */

import { NIST_CSF_FUNCTIONS, NIST_CSF_QUESTIONS } from "../nist-csf-questions";

export type NistCsfScorecard = {
  kind: "NIST_CSF";
  overallCurrentTier: number;   // 1-4 average
  targetTier: number;            // 1-4
  functions: Array<{ name: string; currentTier: number; gap: number }>;
  gaps: Array<{ functionName: string; description: string; severity: "high" | "medium" | "low" }>;
  remediationRoadmap: Array<{ phase: "0-30" | "31-90" | "91-365"; item: string }>;
};

function getOptionWeight(qid: string, answerValue: unknown): number | null {
  const q = NIST_CSF_QUESTIONS.find((x) => x.id === qid);
  if (!q || !q.options) return null;
  const v = typeof answerValue === "string" ? answerValue : undefined;
  if (!v) return null;
  const opt = q.options.find((o) => o.value === v);
  return opt?.weight ?? null;
}

export function scoreNistCsf(answers: Record<string, unknown>): NistCsfScorecard {
  const functions: NistCsfScorecard["functions"] = [];
  const gaps: NistCsfScorecard["gaps"] = [];

  const targetWeight = getOptionWeight("TG01", answers["TG01"]) ?? 3;

  for (const fname of NIST_CSF_FUNCTIONS) {
    const qs = NIST_CSF_QUESTIONS.filter((q) => q.section === fname && q.type === "single_select");
    let sum = 0;
    let count = 0;
    for (const q of qs) {
      const w = getOptionWeight(q.id, answers[q.id]);
      if (w !== null) {
        sum += w;
        count += 1;
      }
    }
    const currentTier = count === 0 ? 0 : Math.round((sum / count) * 10) / 10;
    const gap = Math.max(0, targetWeight - currentTier);
    functions.push({ name: fname, currentTier, gap });

    if (gap >= 1.5) {
      gaps.push({ functionName: fname, severity: "high", description: `${fname}: current Tier ${currentTier} vs target Tier ${targetWeight}.` });
    } else if (gap >= 0.6) {
      gaps.push({ functionName: fname, severity: "medium", description: `${fname}: minor lift needed (${currentTier} → ${targetWeight}).` });
    } else if (gap > 0) {
      gaps.push({ functionName: fname, severity: "low", description: `${fname}: small alignment work to reach target.` });
    }
  }

  const overallCurrentTier = functions.length === 0
    ? 0
    : Math.round((functions.reduce((s, f) => s + f.currentTier, 0) / functions.length) * 10) / 10;

  // Roadmap: highest-severity gaps go to 0-30, mediums 31-90, lows 91-365.
  const remediationRoadmap: NistCsfScorecard["remediationRoadmap"] = [];
  for (const g of gaps) {
    if (g.severity === "high") {
      remediationRoadmap.push({ phase: "0-30", item: `Close high-priority gap in ${g.functionName}` });
    } else if (g.severity === "medium") {
      remediationRoadmap.push({ phase: "31-90", item: `Improve ${g.functionName} toward target Tier ${targetWeight}` });
    } else {
      remediationRoadmap.push({ phase: "91-365", item: `Polish ${g.functionName} for full target Tier alignment` });
    }
  }
  // Always include a baseline closing item
  remediationRoadmap.push({ phase: "91-365", item: "Re-run NIST CSF self-assessment at next QBR" });

  return {
    kind: "NIST_CSF",
    overallCurrentTier,
    targetTier: targetWeight,
    functions,
    gaps,
    remediationRoadmap,
  };
}

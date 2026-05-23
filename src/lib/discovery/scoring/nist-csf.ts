/**
 * NIST CSF 2.0 scoring: aggregate the 106 Subcategory tier scores by Category
 * and Function. Produces current vs. target Tier gap, prioritized remediation
 * roadmap, and Function-level coverage stats.
 */

import { NIST_CSF_FUNCTIONS, NIST_CSF_QUESTIONS, functionOf } from "../nist-csf-questions";

export type NistCsfScorecard = {
  kind: "NIST_CSF";
  overallCurrentTier: number;
  targetTier: number;
  functions: Array<{
    name: string;
    currentTier: number;
    gap: number;
    answered: number;
    subcategoryCount: number;
    coverage: number; // 0-100 %
    categories: Array<{ name: string; currentTier: number; answered: number; subcategoryCount: number }>;
  }>;
  gaps: Array<{ functionName: string; description: string; severity: "high" | "medium" | "low" }>;
  remediationRoadmap: Array<{ phase: "0-30" | "31-90" | "91-365"; item: string }>;
  /** Subcategory IDs answered as Tier 1 — top remediation targets. */
  highRiskSubcategories: string[];
};

function getOptionWeight(qid: string, answerValue: unknown): number | null {
  const q = NIST_CSF_QUESTIONS.find((x) => x.id === qid);
  if (!q || !q.options) return null;
  const v = typeof answerValue === "string" ? answerValue : undefined;
  if (!v) return null;
  const opt = q.options.find((o) => o.value === v);
  if (!opt) return null;
  // "Not applicable" → exclude from averages.
  if (opt.value === "na") return null;
  return opt.weight ?? null;
}

function categoryOf(section: string): string {
  const parts = section.split("·").map((s) => s.trim());
  return parts[1] ?? "Other";
}

export function scoreNistCsf(answers: Record<string, unknown>): NistCsfScorecard {
  const targetWeight = getOptionWeight("TG01", answers["TG01"]) ?? 3;

  const functions: NistCsfScorecard["functions"] = [];
  const gaps: NistCsfScorecard["gaps"] = [];
  const highRisk: string[] = [];

  const tierQuestions = NIST_CSF_QUESTIONS.filter(
    (q) => q.type === "single_select" && q.id !== "TG01",
  );

  for (const fname of NIST_CSF_FUNCTIONS) {
    const fnQs = tierQuestions.filter((q) => functionOf(q) === fname);

    const categoryMap = new Map<string, { sum: number; count: number; total: number }>();
    let fnSum = 0;
    let fnCount = 0;

    for (const q of fnQs) {
      const cat = categoryOf(q.section);
      if (!categoryMap.has(cat)) categoryMap.set(cat, { sum: 0, count: 0, total: 0 });
      const slot = categoryMap.get(cat)!;
      slot.total += 1;

      const w = getOptionWeight(q.id, answers[q.id]);
      if (w !== null) {
        slot.sum += w;
        slot.count += 1;
        fnSum += w;
        fnCount += 1;
        if (w === 1) highRisk.push(q.id);
      }
    }

    const currentTier = fnCount === 0 ? 0 : Math.round((fnSum / fnCount) * 10) / 10;
    const gap = Math.max(0, targetWeight - currentTier);
    const coverage = fnQs.length === 0 ? 100 : Math.round((fnCount / fnQs.length) * 100);

    functions.push({
      name: fname,
      currentTier,
      gap,
      answered: fnCount,
      subcategoryCount: fnQs.length,
      coverage,
      categories: Array.from(categoryMap.entries()).map(([name, slot]) => ({
        name,
        currentTier: slot.count === 0 ? 0 : Math.round((slot.sum / slot.count) * 10) / 10,
        answered: slot.count,
        subcategoryCount: slot.total,
      })),
    });

    if (gap >= 1.5) {
      gaps.push({ functionName: fname, severity: "high", description: `${fname}: current Tier ${currentTier} vs target Tier ${targetWeight}.` });
    } else if (gap >= 0.6) {
      gaps.push({ functionName: fname, severity: "medium", description: `${fname}: minor lift needed (${currentTier} → ${targetWeight}).` });
    } else if (gap > 0) {
      gaps.push({ functionName: fname, severity: "low", description: `${fname}: small alignment work to reach target.` });
    }
  }

  const totalAnswered = functions.reduce((s, f) => s + f.answered, 0);
  const totalSum = functions.reduce((s, f) => s + f.currentTier * f.answered, 0);
  const overallCurrentTier = totalAnswered === 0 ? 0 : Math.round((totalSum / totalAnswered) * 10) / 10;

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
  if (highRisk.length > 0) {
    remediationRoadmap.unshift({
      phase: "0-30",
      item: `Address ${highRisk.length} Tier 1 Subcategor${highRisk.length === 1 ? "y" : "ies"} (highest-risk gaps): ${highRisk.slice(0, 5).join(", ")}${highRisk.length > 5 ? "…" : ""}`,
    });
  }
  remediationRoadmap.push({ phase: "91-365", item: "Re-run NIST CSF self-assessment at next QBR" });

  return {
    kind: "NIST_CSF",
    overallCurrentTier,
    targetTier: targetWeight,
    functions,
    gaps,
    remediationRoadmap,
    highRiskSubcategories: highRisk,
  };
}

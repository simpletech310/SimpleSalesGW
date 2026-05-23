/**
 * Lead Qualification Scorecard — salesperson's MANUAL judgment, captured at
 * discovery time. Complementary to (NOT replacing) the engine's `customerScore`
 * which is computed from the 25-question assessment answers.
 *
 * 8 dimensions per 07-Sales-and-Operations/01_Sales_Playbook.md:
 *   - industryFit      0-15   (Gateway's 9 priority verticals)
 *   - sizeFit          0-15   (10-250 seat sweet spot)
 *   - geography        0-10   (Houston metro / TX / national)
 *   - growthPosture    0-10   (growing / stable / shrinking)
 *   - authority        0-15   (decision-maker engaged?)
 *   - budget           0-15   (explicit IT spend, cyber line item)
 *   - timeline         0-10   (urgency / renewal event / breach)
 *   - complianceDriver 0-10   (HIPAA/PCI/CMMC/cyber-insurance)
 * Total max: 100.
 *
 * Verdict bucketing:
 *   80-100: LIGHTHOUSE   — strategic fit, fast-track + executive sponsor
 *   60-79:  STRONG_FIT   — pursue normally
 *   40-59:  MARGINAL     — pursue with caution; require manager sign-off pre-proposal
 *   20-39:  REFER        — refer to partner / channel; don't deplete Lin's bandwidth
 *    0-19:  DECLINE      — politely decline; not a Gateway-fit account
 */

import { QualificationVerdict } from "@prisma/client";

export const QUALIFICATION_DIMENSIONS = [
  { key: "industryFit",      label: "Industry fit",       max: 15, help: "Aligns with one of Gateway's nine priority verticals." },
  { key: "sizeFit",          label: "Size fit",            max: 15, help: "10-250 seat sweet spot. Outside band lowers score." },
  { key: "geography",        label: "Geography",           max: 10, help: "Houston metro = 10. Texas = 7. National = 5. Remote-only = 4." },
  { key: "growthPosture",    label: "Growth posture",      max: 10, help: "Growing/hiring = 10. Stable = 6. Shrinking = 2." },
  { key: "authority",        label: "Authority engaged",   max: 15, help: "Decision-maker present in calls and committed to evaluation." },
  { key: "budget",           label: "Budget signal",       max: 15, help: "Explicit IT spend line item or cyber-insurance-driven budget unlocked." },
  { key: "timeline",         label: "Timeline / urgency",  max: 10, help: "Compelling event: renewal, breach, audit, contract end." },
  { key: "complianceDriver", label: "Compliance driver",   max: 10, help: "Active regulation (HIPAA / PCI / CMMC / cyber insurance)." },
] as const;

export type QualificationDimensionKey = (typeof QUALIFICATION_DIMENSIONS)[number]["key"];

export type QualificationInput = Record<QualificationDimensionKey, number>;

export const MAX_TOTAL = QUALIFICATION_DIMENSIONS.reduce((s, d) => s + d.max, 0); // 100

export function clampDimension(key: QualificationDimensionKey, value: number): number {
  const dim = QUALIFICATION_DIMENSIONS.find((d) => d.key === key);
  if (!dim) return 0;
  const n = Math.floor(Number.isFinite(value) ? value : 0);
  if (n < 0) return 0;
  if (n > dim.max) return dim.max;
  return n;
}

export function computeTotal(input: Partial<QualificationInput>): number {
  let total = 0;
  for (const d of QUALIFICATION_DIMENSIONS) {
    const v = clampDimension(d.key, Number(input[d.key] ?? 0));
    total += v;
  }
  return total;
}

export function verdictFor(total: number): QualificationVerdict {
  if (total >= 80) return QualificationVerdict.LIGHTHOUSE;
  if (total >= 60) return QualificationVerdict.STRONG_FIT;
  if (total >= 40) return QualificationVerdict.MARGINAL;
  if (total >= 20) return QualificationVerdict.REFER;
  return QualificationVerdict.DECLINE;
}

export const VERDICT_LABEL: Record<QualificationVerdict, string> = {
  LIGHTHOUSE: "Lighthouse account",
  STRONG_FIT: "Strong fit",
  MARGINAL:   "Marginal",
  REFER:      "Refer out",
  DECLINE:    "Decline",
};

export const VERDICT_BLURB: Record<QualificationVerdict, string> = {
  LIGHTHOUSE: "Strategic fit. Fast-track + executive sponsor.",
  STRONG_FIT: "Pursue normally — solid Gateway-fit account.",
  MARGINAL:   "Pursue with caution. Sales Manager sign-off before proposal.",
  REFER:      "Refer to partner / channel — don't deplete bandwidth.",
  DECLINE:    "Politely decline. Not a Gateway-fit engagement.",
};

/** Convenience: full computation in one call. */
export function scoreQualification(input: Partial<QualificationInput>): {
  total: number;
  verdict: QualificationVerdict;
  dimensions: Array<{ key: QualificationDimensionKey; label: string; score: number; max: number }>;
} {
  const dimensions = QUALIFICATION_DIMENSIONS.map((d) => ({
    key: d.key,
    label: d.label,
    max: d.max,
    score: clampDimension(d.key, Number(input[d.key] ?? 0)),
  }));
  const total = dimensions.reduce((s, d) => s + d.score, 0);
  return { total, verdict: verdictFor(total), dimensions };
}

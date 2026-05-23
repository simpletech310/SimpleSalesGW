import { describe, expect, it } from "vitest";
import { NIST_CSF_QUESTIONS, NIST_CSF_FUNCTIONS, functionOf } from "@/lib/discovery/nist-csf-questions";
import { scoreNistCsf } from "@/lib/discovery/scoring/nist-csf";

describe("NIST CSF 2.0 — full 106 Subcategory bank", () => {
  it("has 106 scoreable Subcategories", () => {
    const scoreable = NIST_CSF_QUESTIONS.filter(
      (q) => q.type === "single_select" && q.id !== "TG01",
    );
    expect(scoreable.length).toBe(106);
  });

  it("Subcategory counts per Function match CSF 2.0 (GV 31, ID 21, PR 22, DE 11, RS 13, RC 8)", () => {
    const counts: Record<string, number> = {};
    for (const q of NIST_CSF_QUESTIONS.filter((q) => q.type === "single_select" && q.id !== "TG01")) {
      const f = functionOf(q);
      counts[f] = (counts[f] ?? 0) + 1;
    }
    expect(counts.Govern).toBe(31);
    expect(counts.Identify).toBe(21);
    expect(counts.Protect).toBe(22);
    expect(counts.Detect).toBe(11);
    expect(counts.Respond).toBe(13);
    expect(counts.Recover).toBe(8);
  });

  it("has 6 Functions in canonical order", () => {
    expect(NIST_CSF_FUNCTIONS).toEqual(["Govern", "Identify", "Protect", "Detect", "Respond", "Recover"]);
  });
});

describe("NIST CSF scoring rollup", () => {
  it("rolls up Function tier from Subcategory answers", () => {
    const answers: Record<string, unknown> = { TG01: "tier_3" };
    // Set all Govern Subcategories to tier_4
    for (const q of NIST_CSF_QUESTIONS) {
      if (q.id.startsWith("GV.") && q.type === "single_select") answers[q.id] = "tier_4";
    }
    const r = scoreNistCsf(answers);
    const gv = r.functions.find((f) => f.name === "Govern")!;
    expect(gv.currentTier).toBe(4);
    expect(gv.gap).toBe(0);
  });

  it("flags high-severity gap when current is more than 1.5 below target", () => {
    const answers: Record<string, unknown> = { TG01: "tier_4" };
    for (const q of NIST_CSF_QUESTIONS) {
      if (q.id.startsWith("PR.") && q.type === "single_select") answers[q.id] = "tier_1";
    }
    const r = scoreNistCsf(answers);
    expect(r.gaps.some((g) => g.functionName === "Protect" && g.severity === "high")).toBe(true);
    expect(r.highRiskSubcategories.length).toBeGreaterThan(0);
  });

  it("excludes Not-Applicable from averages", () => {
    const answers: Record<string, unknown> = { TG01: "tier_3" };
    let first = true;
    for (const q of NIST_CSF_QUESTIONS) {
      if (q.id.startsWith("RC.") && q.type === "single_select") {
        answers[q.id] = first ? "na" : "tier_4";
        first = false;
      }
    }
    const r = scoreNistCsf(answers);
    const rc = r.functions.find((f) => f.name === "Recover")!;
    // All non-NA answers were tier_4, so the rollup should be 4 (NAs excluded)
    expect(rc.currentTier).toBe(4);
  });

  it("default target tier is 3 if not specified", () => {
    const r = scoreNistCsf({});
    expect(r.targetTier).toBe(3);
  });
});

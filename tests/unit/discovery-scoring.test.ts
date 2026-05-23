import { describe, expect, it } from "vitest";
import { scoreSiteSurvey } from "@/lib/discovery/scoring/site-survey";
import { scoreAiReadiness } from "@/lib/discovery/scoring/ai-readiness";

describe("site survey scoring", () => {
  it("flags high-risk MFA absence", () => {
    const r = scoreSiteSurvey({ ID02: "none" });
    expect(r.risks.some((x) => x.severity === "high" && /MFA/.test(x.description))).toBe(true);
  });

  it("counts surfaced risks in summary", () => {
    const r = scoreSiteSurvey({
      ID02: "none",
      EP01: "no rmm",
      BK04: "never",
      SV06: true,
    });
    expect(r.summary).toMatch(/risk/);
    expect(r.risks.length).toBeGreaterThanOrEqual(3);
  });

  it("notes active regulations as a finding", () => {
    const r = scoreSiteSurvey({ CF01: ["HIPAA", "PCI"] });
    expect(r.findings.some((f) => f.includes("HIPAA"))).toBe(true);
    expect(r.recommendedActions.some((a) => /NIST CSF/.test(a))).toBe(true);
  });

  it("CMMC triggers 800-171 recommendation", () => {
    const r = scoreSiteSurvey({ CF01: ["CMMC"] });
    expect(r.recommendedActions.some((a) => /800-171/.test(a))).toBe(true);
  });
});

describe("AI readiness scoring (v2.1 — 8-dimension scorecard)", () => {
  it("returns 4.0 maturity when all 8 dimensions answered Tier 4", () => {
    const a: Record<string, unknown> = {};
    for (const id of ["MS01", "MS02", "MS03", "MS04", "MS05", "MS06", "MS07", "MS08"]) {
      a[id] = "tier_4";
    }
    const r = scoreAiReadiness(a);
    expect(r.overall).toBe(4);
    for (const d of r.dimensions) {
      expect(d.score).toBe(4);
    }
  });

  it("returns 0.0 maturity when all 8 dimensions answered Tier 0", () => {
    const a: Record<string, unknown> = {};
    for (const id of ["MS01", "MS02", "MS03", "MS04", "MS05", "MS06", "MS07", "MS08"]) {
      a[id] = "tier_0";
    }
    expect(scoreAiReadiness(a).overall).toBe(0);
  });

  it("use-case matrix produces priority = impact × feasibility", () => {
    const r = scoreAiReadiness({
      "UC.SALES.02": "RFP responses",
      "UC.SALES.05": "transformational", // weight 4
      "UC.SALES.06": "high",              // weight 3
      "UC.HR.02": "PTO accruals",
      "UC.HR.05": "low",                  // weight 1
      "UC.HR.06": "very_high",            // weight 4
    });
    const sales = r.useCases.find((u) => u.department === "Sales")!;
    const hr = r.useCases.find((u) => u.department === "HR")!;
    expect(sales.priorityScore).toBe(12);
    expect(hr.priorityScore).toBe(4);
    expect(r.topUseCases[0]?.department).toBe("Sales");
  });

  it("rollout has three populated buckets", () => {
    const r = scoreAiReadiness({});
    expect(r.rollout.days_0_30.length).toBeGreaterThan(0);
    expect(r.rollout.days_31_90.length).toBeGreaterThan(0);
    expect(r.rollout.days_91_365.length).toBeGreaterThan(0);
  });
});

// NIST CSF scoring moved to nist-csf-full.test.ts — that file tests the full
// 106-subcategory roll-up with the v2.1 question IDs (e.g. GV.OC-01).

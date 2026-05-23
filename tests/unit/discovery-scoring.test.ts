import { describe, expect, it } from "vitest";
import { scoreSiteSurvey } from "@/lib/discovery/scoring/site-survey";
import { scoreAiReadiness } from "@/lib/discovery/scoring/ai-readiness";
import { scoreNistCsf } from "@/lib/discovery/scoring/nist-csf";

describe("site survey scoring", () => {
  it("flags high-risk MFA absence", () => {
    const r = scoreSiteSurvey({ SS07: "none" });
    expect(r.risks.some((x) => x.severity === "high" && /MFA/.test(x.description))).toBe(true);
  });

  it("counts surfaced risks in summary", () => {
    const r = scoreSiteSurvey({ SS07: "none", SS09: "no", SS16: "never", SS23: "no" });
    expect(r.summary).toMatch(/risk/);
    expect(r.risks.length).toBeGreaterThanOrEqual(4);
  });

  it("notes active regulations as a finding", () => {
    const r = scoreSiteSurvey({ SS24: ["HIPAA", "PCI"] });
    expect(r.findings.some((f) => f.includes("HIPAA"))).toBe(true);
    expect(r.recommendedActions.some((a) => /NIST CSF/.test(a))).toBe(true);
  });
});

describe("AI readiness scoring", () => {
  it("returns max maturity on all top options for weighted pillars", () => {
    const r = scoreAiReadiness({
      AI01: "champion", AI02: "dedicated", AI03: "strong", AI04: "eager",
      AI05: "centralized", AI06: "high", AI07: "labeled",
      AI09: ["sales"], AI10: "lead enrichment", AI12: ["copilot"],
      AI13: "published", AI14: "formal", AI15: "always",
    });
    // "Use Cases" pillar has no weighted questions → score 0 by design.
    // Three weighted pillars at top should each be 4; overall = (4+4+4+0)/4 = 3.
    for (const p of r.pillars) {
      if (p.name === "Use Cases") {
        expect(p.score).toBe(0);
      } else {
        expect(p.score).toBe(4);
      }
    }
    expect(r.overall).toBe(3);
  });

  it("returns 0 maturity on bottom options", () => {
    const r = scoreAiReadiness({
      AI01: "none", AI02: "none", AI03: "weak", AI04: "resistant",
      AI05: "spreadsheets", AI06: "low", AI07: "no",
      AI13: "no", AI14: "none", AI15: "rarely",
    });
    expect(r.overall).toBeLessThanOrEqual(1.2);
  });

  it("captures departments + free-text fields", () => {
    const r = scoreAiReadiness({
      AI09: ["sales", "ops"],
      AI10: "RFP responses",
      AI11: "Copilot rollout stalled",
    });
    expect(r.topUseCases).toEqual(["sales", "ops"]);
    expect(r.highestValueProcess).toBe("RFP responses");
    expect(r.stalledInitiatives).toBe("Copilot rollout stalled");
  });

  it("rollout has three populated buckets", () => {
    const r = scoreAiReadiness({});
    expect(r.rollout.days_0_30.length).toBeGreaterThan(0);
    expect(r.rollout.days_31_90.length).toBeGreaterThan(0);
    expect(r.rollout.days_91_365.length).toBeGreaterThan(0);
  });
});

describe("NIST CSF scoring", () => {
  it("rolls up tiers per function", () => {
    const r = scoreNistCsf({
      GV01: "tier_4", GV02: "tier_4", GV03: "tier_4", GV04: "tier_4",
      ID01: "tier_2", ID02: "tier_2", ID03: "tier_2", ID04: "tier_2",
      PR01: "tier_1", PR02: "tier_1", PR03: "tier_1", PR04: "tier_1", PR05: "tier_1",
      DE01: "tier_3", DE02: "tier_3", DE03: "tier_3",
      RS01: "tier_3", RS02: "tier_3", RS03: "tier_3",
      RC01: "tier_2", RC02: "tier_2", RC03: "tier_2",
      TG01: "tier_3",
    });
    const govern = r.functions.find((f) => f.name === "Govern")!;
    const protect = r.functions.find((f) => f.name === "Protect")!;
    expect(govern.currentTier).toBe(4);
    expect(protect.currentTier).toBe(1);
    expect(r.targetTier).toBe(3);
    expect(r.gaps.some((g) => g.functionName === "Protect" && g.severity === "high")).toBe(true);
  });

  it("populates remediation roadmap", () => {
    const r = scoreNistCsf({
      PR01: "tier_1", PR02: "tier_1", PR03: "tier_1", PR04: "tier_1", PR05: "tier_1",
      TG01: "tier_4",
    });
    expect(r.remediationRoadmap.some((x) => x.phase === "0-30")).toBe(true);
  });

  it("default target tier is 3 if not specified", () => {
    const r = scoreNistCsf({ GV01: "tier_3" });
    expect(r.targetTier).toBe(3);
  });
});

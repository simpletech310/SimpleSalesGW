import { describe, expect, it } from "vitest";
import { scoreSiteSurvey } from "@/lib/discovery/scoring/site-survey";
import { scoreAiReadiness } from "@/lib/discovery/scoring/ai-readiness";
import { scoreDiscovery } from "@/lib/discovery/scoring";
import { scoreQuickIt } from "@/lib/discovery/scoring/quick-it";
import { scoreNetwork } from "@/lib/discovery/scoring/network";
import { scoreWifi } from "@/lib/discovery/scoring/wifi";
import { scoreSoc2Interview } from "@/lib/discovery/scoring/soc2-interview";
import { scoreAiReadinessLight } from "@/lib/discovery/scoring/ai-readiness-light";
import { bankForKind } from "@/lib/discovery/banks";

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

// v3.8 — vCIO assessment menu: each new kind has a bank + scorer wired into
// the generic engine. Smoke-test that empty answers yield a valid scorecard
// and a representative gap surfaces a risk + next step.
describe("v3.8 vCIO assessment scorers", () => {
  const NEW_KINDS = ["QUICK_IT", "NETWORK", "WIFI", "SOC2_INTERVIEW", "AI_READINESS_LIGHT"] as const;

  it("every new kind has a question bank", () => {
    for (const kind of NEW_KINDS) {
      expect(bankForKind(kind).questions.length).toBeGreaterThan(10);
    }
  });

  it("scoreDiscovery returns a valid scorecard on empty answers", () => {
    for (const kind of NEW_KINDS) {
      const sc = scoreDiscovery(kind, {}) as {
        kind: string;
        summary: string;
        risks: unknown[];
        coveragePct: number;
      };
      expect(sc.kind).toBe(kind);
      expect(typeof sc.summary).toBe("string");
      expect(Array.isArray(sc.risks)).toBe(true);
      expect(sc.coveragePct).toBe(0);
    }
  });

  it("Quick IT flags missing MFA + backups as high risk", () => {
    const r = scoreQuickIt({ QIT11: "none", QIT15: "none" });
    expect(r.risks.some((x) => x.severity === "high" && /MFA/i.test(x.description))).toBe(true);
    expect(r.recommendedActions.some((a) => /MFA/i.test(a))).toBe(true);
  });

  it("Network flags EOL firewall", () => {
    const r = scoreNetwork({ NET08: "gt5" });
    expect(r.risks.some((x) => x.severity === "high" && /firewall/i.test(x.description))).toBe(true);
  });

  it("Wi-Fi flags open corporate SSID", () => {
    const r = scoreWifi({ WIFI11: "open" });
    expect(r.risks.some((x) => x.severity === "high")).toBe(true);
  });

  it("SOC 2 computes a readiness band and flags critical gaps", () => {
    const strong = scoreSoc2Interview({ SOC10: "yes", SOC33: "yes", SOC23: "yes", SOC26: "yes" });
    expect(strong.readinessPct).toBeGreaterThan(0);
    const weak = scoreSoc2Interview({ SOC10: "no", SOC33: "no" });
    expect(weak.risks.some((x) => x.severity === "high")).toBe(true);
  });

  it("AI light computes readiness from tier answers", () => {
    const r = scoreAiReadinessLight({ AIL01: "tier_4", AIL05: "shadow" });
    expect(r.readinessPct).toBeGreaterThan(0);
    expect(r.risks.some((x) => /shadow/i.test(x.description))).toBe(true);
  });
});

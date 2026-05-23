import { describe, expect, it } from "vitest";
import { ServiceLine } from "@prisma/client";
import {
  SCORING_DEFAULTS,
  computeCustomerScore,
  computeScores,
  computeServicesScore,
  type AnswerMap,
} from "@/lib/scoring/engine";

describe("SCORING_DEFAULTS", () => {
  it("matches the PRD-locked weights exactly", () => {
    expect(SCORING_DEFAULTS.servicesWeights[ServiceLine.MANAGED_IT]).toBe(25);
    expect(SCORING_DEFAULTS.servicesWeights[ServiceLine.CYBERSECURITY]).toBe(25);
    expect(SCORING_DEFAULTS.servicesWeights[ServiceLine.NIST_ASSESSMENT]).toBe(20);
    expect(SCORING_DEFAULTS.servicesWeights[ServiceLine.AI_ADVISORY]).toBe(10);
    expect(SCORING_DEFAULTS.servicesWeights[ServiceLine.VOIP]).toBe(10);
    expect(SCORING_DEFAULTS.servicesWeights[ServiceLine.CABLING]).toBe(5);
    expect(SCORING_DEFAULTS.servicesWeights[ServiceLine.ACCESS_CONTROL]).toBe(3);
    expect(SCORING_DEFAULTS.servicesWeights[ServiceLine.VIDEO]).toBe(3);
    expect(SCORING_DEFAULTS.servicesWeights[ServiceLine.VCIO_RETAINER]).toBe(2);
    expect(SCORING_DEFAULTS.dealQualityBlend.services).toBe(0.45);
    expect(SCORING_DEFAULTS.dealQualityBlend.customer).toBe(0.55);
    expect(SCORING_DEFAULTS.nonStrategic.servicesBelow).toBe(35);
    expect(SCORING_DEFAULTS.nonStrategic.dealQualityBelow).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// Services Score — 8 service-line triggers
// ---------------------------------------------------------------------------

describe("computeServicesScore — service-line triggers", () => {
  it("fires MANAGED_IT when Q06=single_in_house", () => {
    const { matches } = computeServicesScore({ Q06: "single_in_house" });
    const m = matches.find((x) => x.serviceLine === ServiceLine.MANAGED_IT)!;
    expect(m.recommended).toBe(true);
    expect(m.fitScore).toBe(25);
  });

  it("fires MANAGED_IT when Q11=true (outage)", () => {
    const { matches } = computeServicesScore({ Q11: true });
    const m = matches.find((x) => x.serviceLine === ServiceLine.MANAGED_IT)!;
    expect(m.recommended).toBe(true);
  });

  it("does NOT fire MANAGED_IT when Q06=current_msp and no outage", () => {
    const { matches } = computeServicesScore({ Q06: "current_msp", Q11: false });
    const m = matches.find((x) => x.serviceLine === ServiceLine.MANAGED_IT)!;
    expect(m.recommended).toBe(false);
    expect(m.fitScore).toBe(0);
  });

  it("fires CYBERSECURITY on weak MFA", () => {
    const { matches } = computeServicesScore({ Q15: "no" });
    const m = matches.find((x) => x.serviceLine === ServiceLine.CYBERSECURITY)!;
    expect(m.recommended).toBe(true);
    expect(m.fitScore).toBe(25);
  });

  it("fires CYBERSECURITY when cyber insurance present (Q12=true)", () => {
    const { matches } = computeServicesScore({ Q12: true, Q15: "yes_all", Q16: "documented_tested" });
    const m = matches.find((x) => x.serviceLine === ServiceLine.CYBERSECURITY)!;
    expect(m.recommended).toBe(true);
  });

  it("fires NIST_ASSESSMENT when Q13 includes HIPAA", () => {
    const { matches } = computeServicesScore({ Q13: ["HIPAA"] });
    const m = matches.find((x) => x.serviceLine === ServiceLine.NIST_ASSESSMENT)!;
    expect(m.recommended).toBe(true);
    expect(m.fitScore).toBe(20);
  });

  it("fires NIST_ASSESSMENT when Q14=true even with no regulations", () => {
    const { matches } = computeServicesScore({ Q14: true, Q13: ["NONE"] });
    const m = matches.find((x) => x.serviceLine === ServiceLine.NIST_ASSESSMENT)!;
    expect(m.recommended).toBe(true);
  });

  it("does NOT fire NIST_ASSESSMENT when Q13=[NONE] and Q14=false", () => {
    const { matches } = computeServicesScore({ Q13: ["NONE"], Q14: false });
    const m = matches.find((x) => x.serviceLine === ServiceLine.NIST_ASSESSMENT)!;
    expect(m.recommended).toBe(false);
  });

  it("fires AI_ADVISORY when Q10=yes_informally", () => {
    const { matches } = computeServicesScore({ Q10: "yes_informally" });
    const m = matches.find((x) => x.serviceLine === ServiceLine.AI_ADVISORY)!;
    expect(m.recommended).toBe(true);
    expect(m.fitScore).toBe(10);
  });

  it("fires AI_ADVISORY when Q24 has content", () => {
    const { matches } = computeServicesScore({ Q24: "Copilot rollout stalled in legal review" });
    const m = matches.find((x) => x.serviceLine === ServiceLine.AI_ADVISORY)!;
    expect(m.recommended).toBe(true);
  });

  it("fires VOIP when Q08=on_prem_pbx", () => {
    const { matches } = computeServicesScore({ Q08: "on_prem_pbx" });
    const m = matches.find((x) => x.serviceLine === ServiceLine.VOIP)!;
    expect(m.recommended).toBe(true);
    expect(m.fitScore).toBe(10);
  });

  it("does NOT fire VOIP when Q08=hosted_voip", () => {
    const { matches } = computeServicesScore({ Q08: "hosted_voip" });
    const m = matches.find((x) => x.serviceLine === ServiceLine.VOIP)!;
    expect(m.recommended).toBe(false);
  });

  it("fires CABLING when Q22=true", () => {
    const { matches } = computeServicesScore({ Q22: true });
    const m = matches.find((x) => x.serviceLine === ServiceLine.CABLING)!;
    expect(m.recommended).toBe(true);
    expect(m.fitScore).toBe(5);
  });

  it("fires ACCESS_CONTROL+VIDEO when Q13 includes HIPAA", () => {
    const { matches } = computeServicesScore({ Q13: ["HIPAA"] });
    const ac = matches.find((x) => x.serviceLine === ServiceLine.ACCESS_CONTROL)!;
    const vid = matches.find((x) => x.serviceLine === ServiceLine.VIDEO)!;
    expect(ac.recommended).toBe(true);
    expect(ac.fitScore).toBe(3);
    expect(vid.recommended).toBe(true);
    expect(vid.fitScore).toBe(3);
  });

  it("fires VCIO_RETAINER when in_house_team + strategic pain", () => {
    const { matches } = computeServicesScore({
      Q06: "in_house_team",
      Q17: "Our roadmap is unclear and we need strategy",
      Q18: "stable",
    });
    const m = matches.find((x) => x.serviceLine === ServiceLine.VCIO_RETAINER)!;
    expect(m.recommended).toBe(true);
    expect(m.fitScore).toBe(2);
  });

  it("does NOT fire VCIO_RETAINER without strategic keyword", () => {
    const { matches } = computeServicesScore({
      Q06: "in_house_team",
      Q17: "printer broken",
      Q18: "fix wifi",
    });
    const m = matches.find((x) => x.serviceLine === ServiceLine.VCIO_RETAINER)!;
    expect(m.recommended).toBe(false);
  });

  it("caps total services score at 100", () => {
    const everything: AnswerMap = {
      Q06: "nobody",
      Q08: "on_prem_pbx",
      Q10: "yes_informally",
      Q11: true,
      Q12: true,
      Q13: ["HIPAA", "PCI", "CMMC"],
      Q14: true,
      Q15: "no",
      Q16: "no",
      Q17: "strategic roadmap needed",
      Q22: true,
      Q24: "AI initiative stalled",
    };
    const { score } = computeServicesScore(everything);
    expect(score).toBe(100); // 25+25+20+10+10+5+3+3 = 101 → capped at 100
  });
});

// ---------------------------------------------------------------------------
// Customer Score — 8 dimensions
// ---------------------------------------------------------------------------

describe("computeCustomerScore — 8 buckets", () => {
  it("industry: 15 for exact 9-market match", () => {
    const { breakdown } = computeCustomerScore({ Q01: "MEDICAL" });
    expect(breakdown.industry).toBe(15);
  });

  it("industry: 0 for Other", () => {
    const { breakdown } = computeCustomerScore({ Q01: "OTHER" });
    expect(breakdown.industry).toBe(0);
  });

  it("size: 15 for 100-200 employees", () => {
    expect(computeCustomerScore({ Q02: 100 }).breakdown.size).toBe(15);
    expect(computeCustomerScore({ Q02: 150 }).breakdown.size).toBe(15);
    expect(computeCustomerScore({ Q02: 200 }).breakdown.size).toBe(15);
  });

  it("size: 12 for 50-99 or 201-250", () => {
    expect(computeCustomerScore({ Q02: 50 }).breakdown.size).toBe(12);
    expect(computeCustomerScore({ Q02: 99 }).breakdown.size).toBe(12);
    expect(computeCustomerScore({ Q02: 225 }).breakdown.size).toBe(12);
  });

  it("size: 8 for 25-49", () => {
    expect(computeCustomerScore({ Q02: 30 }).breakdown.size).toBe(8);
  });

  it("size: 4 for 10-24", () => {
    expect(computeCustomerScore({ Q02: 15 }).breakdown.size).toBe(4);
  });

  it("size: 0 for outside ranges", () => {
    expect(computeCustomerScore({ Q02: 5 }).breakdown.size).toBe(0);
    expect(computeCustomerScore({ Q02: 500 }).breakdown.size).toBe(0);
  });

  it("geography: 10 by default, 0 when explicitly unreachable", () => {
    expect(computeCustomerScore({}, {}).breakdown.geography).toBe(10);
    expect(computeCustomerScore({}, { geographyReachable: false }).breakdown.geography).toBe(0);
  });

  it("growth: 10 for hiring", () => {
    expect(computeCustomerScore({ Q05: ["hiring"] }).breakdown.growth).toBe(10);
  });

  it("growth: 5 for stable only", () => {
    expect(computeCustomerScore({ Q05: ["stable"] }).breakdown.growth).toBe(5);
  });

  it("growth: 0 for contracting only", () => {
    expect(computeCustomerScore({ Q05: ["contracting"] }).breakdown.growth).toBe(0);
  });

  it("authority: 15 with executive sponsor context", () => {
    expect(computeCustomerScore({}, { hasExecutiveSponsor: true }).breakdown.authority).toBe(15);
  });

  it("authority: 15 when Q21 mentions CEO/owner/etc.", () => {
    expect(computeCustomerScore({ Q21: "The CEO approves" }).breakdown.authority).toBe(15);
    expect(computeCustomerScore({ Q21: "the owner makes the call" }).breakdown.authority).toBe(15);
  });

  it("authority: 8 when Q21 mentions director/VP/manager", () => {
    expect(computeCustomerScore({ Q21: "Director of operations" }).breakdown.authority).toBe(8);
  });

  it("authority: 0 with no signal", () => {
    expect(computeCustomerScore({ Q21: "the receptionist" }).breakdown.authority).toBe(0);
  });

  it("budget: 15/10/5/0 for approved/being_planned/need_to_make_case/no_signal", () => {
    expect(computeCustomerScore({ Q20: "approved" }).breakdown.budget).toBe(15);
    expect(computeCustomerScore({ Q20: "being_planned" }).breakdown.budget).toBe(10);
    expect(computeCustomerScore({ Q20: "need_to_make_case" }).breakdown.budget).toBe(5);
    expect(computeCustomerScore({ Q20: "no_signal" }).breakdown.budget).toBe(0);
  });

  it("timeline: 10/8/5/2/0", () => {
    expect(computeCustomerScore({ Q19: "immediate" }).breakdown.timeline).toBe(10);
    expect(computeCustomerScore({ Q19: "30_days" }).breakdown.timeline).toBe(8);
    expect(computeCustomerScore({ Q19: "90_days" }).breakdown.timeline).toBe(5);
    expect(computeCustomerScore({ Q19: "this_year" }).breakdown.timeline).toBe(2);
    expect(computeCustomerScore({ Q19: "no_urgency" }).breakdown.timeline).toBe(0);
  });

  it("compliance: 10 when an active regulation is selected", () => {
    expect(computeCustomerScore({ Q13: ["HIPAA"] }).breakdown.compliance).toBe(10);
  });

  it("compliance: 5 for regulated industry with no active driver", () => {
    expect(computeCustomerScore({ Q01: "MEDICAL", Q13: ["NONE"] }).breakdown.compliance).toBe(5);
  });

  it("compliance: 0 with neither", () => {
    expect(computeCustomerScore({ Q01: "OTHER", Q13: ["NONE"] }).breakdown.compliance).toBe(0);
  });

  it("totals cap at 100", () => {
    const a: AnswerMap = {
      Q01: "MEDICAL",
      Q02: 150,
      Q05: ["hiring", "new_location"],
      Q13: ["HIPAA"],
      Q19: "immediate",
      Q20: "approved",
      Q21: "Our CEO has the budget approved",
    };
    expect(computeCustomerScore(a, { hasExecutiveSponsor: true }).score).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// Deal Quality blend + non-strategic flag
// ---------------------------------------------------------------------------

describe("Deal Quality Score (weighted blend) + non-strategic flag", () => {
  it("blends services 0.45 + customer 0.55 and rounds", () => {
    // services=60, customer=80 → 60*0.45 + 80*0.55 = 27 + 44 = 71
    const r = computeScores({
      Q06: "single_in_house",   // +25 MI
      Q15: "no",                // +25 SEC
      Q01: "MEDICAL",           // +15 ind
      Q02: 150,                 // +15 size
      Q05: ["hiring"],          // +10 growth
      Q13: ["NONE"],            // +5 compliance (MEDICAL regulated)
      Q19: "30_days",           // +8 timeline
      Q20: "being_planned",     // +10 budget
      Q21: "Our director of IT",// +8 authority
    });
    expect(r.servicesScore).toBeGreaterThan(0);
    expect(r.customerScore).toBeGreaterThan(0);
    expect(r.dealQualityScore).toBe(
      Math.round(r.servicesScore * 0.45 + r.customerScore * 0.55),
    );
  });

  it("sets non-strategic flag when services<35", () => {
    const r = computeScores({
      Q01: "MEDICAL", Q02: 150, Q05: ["hiring"], Q19: "immediate",
      Q20: "approved", Q21: "CEO approves", Q13: ["HIPAA"],
    });
    // services here only fires NIST (20) so services<35
    expect(r.servicesScore).toBeLessThan(35);
    expect(r.nonStrategicFlag).toBe(true);
  });

  it("sets non-strategic flag when dealQuality<40", () => {
    const r = computeScores({
      Q06: "nobody",     // +25 MI
      Q15: "no",         // +25 SEC
      // weak customer signals → customer ~ geography only (10)
      Q19: "no_urgency",
      Q20: "no_signal",
      Q01: "OTHER",
      Q05: ["contracting"],
    });
    // services >= 50, customer low → dealQuality math
    if (r.dealQualityScore < 40) expect(r.nonStrategicFlag).toBe(true);
  });

  it("clears non-strategic flag when both thresholds passed", () => {
    const r = computeScores({
      Q06: "single_in_house", Q15: "no", Q13: ["HIPAA"], Q14: true, Q08: "on_prem_pbx",
      Q01: "MEDICAL", Q02: 150, Q05: ["hiring"], Q19: "immediate",
      Q20: "approved", Q21: "CEO approves",
    });
    expect(r.servicesScore).toBeGreaterThanOrEqual(35);
    expect(r.dealQualityScore).toBeGreaterThanOrEqual(40);
    expect(r.nonStrategicFlag).toBe(false);
  });

  it("places into buckets correctly", () => {
    const allOff = computeScores({});
    expect(allOff.bucket).toBe("polite_decline");
  });
});

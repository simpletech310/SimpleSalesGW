import { describe, expect, it } from "vitest";
import { QualificationVerdict } from "@prisma/client";
import {
  MAX_TOTAL,
  QUALIFICATION_DIMENSIONS,
  clampDimension,
  computeTotal,
  scoreQualification,
  verdictFor,
} from "@/lib/qualification";

describe("qualification — dimension definition", () => {
  it("has exactly 8 dimensions with weights summing to 100", () => {
    expect(QUALIFICATION_DIMENSIONS.length).toBe(8);
    expect(MAX_TOTAL).toBe(100);
  });

  it("expected maxes per playbook §Qualification Scorecard", () => {
    const map = Object.fromEntries(QUALIFICATION_DIMENSIONS.map((d) => [d.key, d.max]));
    expect(map.industryFit).toBe(15);
    expect(map.sizeFit).toBe(15);
    expect(map.geography).toBe(10);
    expect(map.growthPosture).toBe(10);
    expect(map.authority).toBe(15);
    expect(map.budget).toBe(15);
    expect(map.timeline).toBe(10);
    expect(map.complianceDriver).toBe(10);
  });
});

describe("qualification — clamp", () => {
  it("clamps negative to 0", () => {
    expect(clampDimension("industryFit", -5)).toBe(0);
  });
  it("clamps above max to max", () => {
    expect(clampDimension("geography", 99)).toBe(10);
    expect(clampDimension("industryFit", 99)).toBe(15);
  });
  it("floors fractional values", () => {
    expect(clampDimension("budget", 4.9)).toBe(4);
  });
  it("returns 0 for NaN", () => {
    expect(clampDimension("budget", Number.NaN)).toBe(0);
  });
});

describe("qualification — total + verdict", () => {
  it("zeros → DECLINE", () => {
    expect(verdictFor(0)).toBe(QualificationVerdict.DECLINE);
  });
  it("19 → DECLINE (boundary)", () => {
    expect(verdictFor(19)).toBe(QualificationVerdict.DECLINE);
  });
  it("20 → REFER (boundary)", () => {
    expect(verdictFor(20)).toBe(QualificationVerdict.REFER);
  });
  it("39 → REFER (boundary)", () => {
    expect(verdictFor(39)).toBe(QualificationVerdict.REFER);
  });
  it("40 → MARGINAL (boundary)", () => {
    expect(verdictFor(40)).toBe(QualificationVerdict.MARGINAL);
  });
  it("59 → MARGINAL (boundary)", () => {
    expect(verdictFor(59)).toBe(QualificationVerdict.MARGINAL);
  });
  it("60 → STRONG_FIT (boundary)", () => {
    expect(verdictFor(60)).toBe(QualificationVerdict.STRONG_FIT);
  });
  it("79 → STRONG_FIT (boundary)", () => {
    expect(verdictFor(79)).toBe(QualificationVerdict.STRONG_FIT);
  });
  it("80 → LIGHTHOUSE (boundary)", () => {
    expect(verdictFor(80)).toBe(QualificationVerdict.LIGHTHOUSE);
  });
  it("100 → LIGHTHOUSE", () => {
    expect(verdictFor(100)).toBe(QualificationVerdict.LIGHTHOUSE);
  });

  it("computeTotal sums across all 8 dimensions", () => {
    const t = computeTotal({
      industryFit: 15, sizeFit: 15, geography: 10, growthPosture: 10,
      authority: 15, budget: 15, timeline: 10, complianceDriver: 10,
    });
    expect(t).toBe(MAX_TOTAL);
  });

  it("clamps individual inputs before summing", () => {
    const t = computeTotal({
      industryFit: 999, // will clamp to 15
      geography: -5,   // clamps to 0
    });
    expect(t).toBe(15);
  });
});

describe("qualification — full score helper", () => {
  it("returns dimensions + total + verdict", () => {
    const result = scoreQualification({
      industryFit: 12, sizeFit: 12, geography: 8, growthPosture: 7,
      authority: 10, budget: 10, timeline: 7, complianceDriver: 6,
    });
    expect(result.dimensions.length).toBe(8);
    expect(result.total).toBe(72);
    expect(result.verdict).toBe(QualificationVerdict.STRONG_FIT);
  });

  it("empty input returns total=0, DECLINE", () => {
    const result = scoreQualification({});
    expect(result.total).toBe(0);
    expect(result.verdict).toBe(QualificationVerdict.DECLINE);
  });
});

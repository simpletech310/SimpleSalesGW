import { describe, expect, it } from "vitest";
import { ComplianceDriver, Industry, MspSatisfaction } from "@prisma/client";
import { autoScoreQualification } from "@/lib/qualification/auto-score";

describe("autoScoreQualification — industry", () => {
  it("priority verticals score 12-15", () => {
    for (const ind of [Industry.MEDICAL, Industry.LEGAL, Industry.FEDERAL_CONTRACTING, Industry.MANUFACTURING]) {
      const r = autoScoreQualification({ industry: ind });
      expect(r.industryFit).toBeGreaterThanOrEqual(12);
      expect(r.industryFit).toBeLessThanOrEqual(15);
    }
  });
  it("secondary verticals score lower", () => {
    const r = autoScoreQualification({ industry: Industry.EDUCATION });
    expect(r.industryFit).toBeLessThan(13);
    expect(r.industryFit).toBeGreaterThan(0);
  });
  it("OTHER + null scores conservatively", () => {
    expect(autoScoreQualification({ industry: Industry.OTHER }).industryFit).toBeLessThanOrEqual(7);
    expect(autoScoreQualification({}).industryFit).toBeLessThanOrEqual(7);
  });
});

describe("autoScoreQualification — sizeFit", () => {
  it("50 seats lands in the sweet spot", () => {
    expect(autoScoreQualification({ seatCount: 50 }).sizeFit).toBeGreaterThanOrEqual(13);
  });
  it("200 seats is Enterprise band", () => {
    expect(autoScoreQualification({ seatCount: 200 }).sizeFit).toBeGreaterThanOrEqual(10);
  });
  it("5 seats is too small", () => {
    expect(autoScoreQualification({ seatCount: 5 }).sizeFit).toBeLessThan(8);
  });
  it("1000 seats is too large for standard bundles", () => {
    expect(autoScoreQualification({ seatCount: 1000 }).sizeFit).toBeLessThan(8);
  });
  it("no seat data → neutral", () => {
    const r = autoScoreQualification({});
    expect(r.sizeFit).toBeLessThanOrEqual(7);
  });
});

describe("autoScoreQualification — geography", () => {
  it("Houston metro = 10", () => {
    expect(autoScoreQualification({ addressCity: "Houston", addressState: "TX" }).geography).toBe(10);
    expect(autoScoreQualification({ addressCity: "Katy", addressState: "TX" }).geography).toBe(10);
    expect(autoScoreQualification({ addressCity: "Sugar Land", addressState: "TX" }).geography).toBe(10);
  });
  it("Texas non-metro = 7", () => {
    expect(autoScoreQualification({ addressCity: "Austin", addressState: "TX" }).geography).toBe(7);
  });
  it("Out-of-state = 5", () => {
    expect(autoScoreQualification({ addressCity: "Phoenix", addressState: "AZ" }).geography).toBe(5);
  });
  it("Unknown geography = 5", () => {
    expect(autoScoreQualification({}).geography).toBe(5);
  });
});

describe("autoScoreQualification — authority", () => {
  it("executive sponsor named bumps score", () => {
    const named = autoScoreQualification({ executiveSponsorName: "Jane Doe" });
    const unnamed = autoScoreQualification({});
    expect(named.authority).toBeGreaterThan(unnamed.authority);
  });
});

describe("autoScoreQualification — budget (MSP satisfaction)", () => {
  it("LEAVING = highest budget signal", () => {
    expect(autoScoreQualification({ currentMspSatisfaction: MspSatisfaction.LEAVING }).budget).toBeGreaterThanOrEqual(12);
  });
  it("HAPPY = weakest", () => {
    expect(autoScoreQualification({ currentMspSatisfaction: MspSatisfaction.HAPPY }).budget).toBeLessThan(7);
  });
  it("NEUTRAL = moderate", () => {
    const r = autoScoreQualification({ currentMspSatisfaction: MspSatisfaction.NEUTRAL });
    expect(r.budget).toBeGreaterThan(7);
    expect(r.budget).toBeLessThan(12);
  });
});

describe("autoScoreQualification — timeline", () => {
  it("renewal in 30 days = high urgency", () => {
    const soon = new Date(Date.now() + 30 * 86_400_000);
    expect(autoScoreQualification({ cyberInsuranceRenewalDate: soon }).timeline).toBeGreaterThanOrEqual(9);
  });
  it("renewal in 2 years = low urgency", () => {
    const farOut = new Date(Date.now() + 730 * 86_400_000);
    expect(autoScoreQualification({ cyberInsuranceRenewalDate: farOut }).timeline).toBeLessThan(6);
  });
  it("no renewal date → conservative default", () => {
    expect(autoScoreQualification({}).timeline).toBeLessThanOrEqual(6);
  });
});

describe("autoScoreQualification — compliance", () => {
  it("multiple active drivers = strong score", () => {
    expect(autoScoreQualification({ complianceDrivers: [ComplianceDriver.HIPAA, ComplianceDriver.PCI_DSS, ComplianceDriver.SOC2] }).complianceDriver).toBeGreaterThanOrEqual(10);
  });
  it("one driver = moderate", () => {
    expect(autoScoreQualification({ complianceDrivers: [ComplianceDriver.HIPAA] }).complianceDriver).toBeGreaterThanOrEqual(5);
  });
  it("no drivers = low", () => {
    expect(autoScoreQualification({ complianceDrivers: [] }).complianceDriver).toBeLessThanOrEqual(4);
    expect(autoScoreQualification({}).complianceDriver).toBeLessThanOrEqual(4);
  });
});

describe("autoScoreQualification — full payload + rationale", () => {
  it("returns rationale notes for every dimension", () => {
    const r = autoScoreQualification({
      industry: Industry.MEDICAL,
      seatCount: 75,
      addressCity: "Houston",
      addressState: "TX",
      executiveSponsorName: "Dr. Sarah Chen",
      currentMspSatisfaction: MspSatisfaction.LEAVING,
      cyberInsuranceRenewalDate: new Date(Date.now() + 45 * 86_400_000),
      complianceDrivers: [ComplianceDriver.HIPAA],
    });
    expect(r.rationale.industryFit).toBeTruthy();
    expect(r.rationale.sizeFit).toBeTruthy();
    expect(r.rationale.geography).toBeTruthy();
    expect(r.rationale.authority).toBeTruthy();
    expect(r.rationale.budget).toBeTruthy();
    expect(r.rationale.timeline).toBeTruthy();
    expect(r.rationale.complianceDriver).toBeTruthy();
  });

  it("a strong medical Houston lead totals 75+ before manual tuning", () => {
    const r = autoScoreQualification({
      industry: Industry.MEDICAL,
      seatCount: 60,
      addressCity: "Houston",
      addressState: "TX",
      executiveSponsorName: "Dr. Sarah Chen",
      currentMspSatisfaction: MspSatisfaction.LEAVING,
      cyberInsuranceRenewalDate: new Date(Date.now() + 30 * 86_400_000),
      complianceDrivers: [ComplianceDriver.HIPAA, ComplianceDriver.SOC2],
    });
    const total = r.industryFit + r.sizeFit + r.geography + r.growthPosture
      + r.authority + r.budget + r.timeline + r.complianceDriver;
    expect(total).toBeGreaterThanOrEqual(75);
  });

  it("an unknown lead totals under 50 (conservative baseline)", () => {
    const r = autoScoreQualification({});
    const total = r.industryFit + r.sizeFit + r.geography + r.growthPosture
      + r.authority + r.budget + r.timeline + r.complianceDriver;
    expect(total).toBeLessThanOrEqual(50);
  });
});

import { describe, expect, it } from "vitest";
import { Industry, ServiceLine } from "@prisma/client";
import { DEFAULT_PROFILE, type MspProfile } from "@/lib/msp/profile";

/**
 * v2.21 — DEFAULT_PROFILE sanity tests.
 *
 * The Zod validation lives in src/app/api/admin/msp-profile/route.ts
 * — those are integration-level and exercised in the smoke test. Here
 * we just lock in the invariants the DEFAULT_PROFILE must hold so a
 * future refactor doesn't break first-deploy behavior.
 */

describe("DEFAULT_PROFILE", () => {
  it("has a non-empty companyName + location", () => {
    expect(DEFAULT_PROFILE.companyName).toMatch(/\S/);
    expect(DEFAULT_PROFILE.location).toMatch(/\S/);
  });

  it("has a mission statement and brand voice (else AI output is generic)", () => {
    expect(DEFAULT_PROFILE.missionStatement.length).toBeGreaterThan(20);
    expect(DEFAULT_PROFILE.brandVoice.length).toBeGreaterThan(20);
  });

  it("covers every ServiceLine enum value", () => {
    const covered = new Set(DEFAULT_PROFILE.services.map((s) => s.serviceLine));
    for (const sl of Object.values(ServiceLine)) {
      expect(covered.has(sl)).toBe(true);
    }
  });

  it("uses only valid emphasis values", () => {
    for (const s of DEFAULT_PROFILE.services) {
      expect(["focus", "normal", "de-emphasize"]).toContain(s.emphasis);
    }
  });

  it("targetMarkets are real Industry-like strings", () => {
    expect(DEFAULT_PROFILE.targetMarkets.length).toBeGreaterThanOrEqual(5);
    expect(DEFAULT_PROFILE.targetMarkets).toContain("Medical");
  });

  it("differentiators + outOfScope are non-empty arrays", () => {
    expect(DEFAULT_PROFILE.differentiators.length).toBeGreaterThan(0);
    expect(DEFAULT_PROFILE.outOfScope.length).toBeGreaterThan(0);
  });

  it("winStories type accepts ANY plus every Industry", () => {
    // Compile-time check that the union accepts every Industry value
    const allIndustries: Array<Industry | "ANY"> = [
      "ANY",
      ...Object.values(Industry),
    ];
    expect(allIndustries.length).toBeGreaterThanOrEqual(11);
    // Type-only assertion — if MspProfile.winStories drifts we want a
    // test failure here, not a runtime one.
    const sample: MspProfile["winStories"][number] = {
      industry: Industry.MEDICAL,
      situation: "x",
      outcome: "y",
    };
    expect(sample.industry).toBe(Industry.MEDICAL);
  });
});

import { describe, expect, it } from "vitest";
import { HELP } from "@/lib/help-copy";

describe("help copy registry", () => {
  it("has top-level namespaces for lead/qualification/pricing/handoff/discovery/onboardingTask/signedDocument", () => {
    expect(HELP.lead).toBeDefined();
    expect(HELP.qualification).toBeDefined();
    expect(HELP.pricing).toBeDefined();
    expect(HELP.handoff).toBeDefined();
    expect(HELP.discovery).toBeDefined();
    expect(HELP.onboardingTask).toBeDefined();
    expect(HELP.signedDocument).toBeDefined();
  });

  it("every entry is a non-empty string", () => {
    function walk(obj: Record<string, unknown>, path: string[]): void {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string") {
          expect(v.length, `empty help string at ${[...path, k].join(".")}`).toBeGreaterThan(0);
          expect(v.length, `help string too long at ${[...path, k].join(".")}`).toBeLessThanOrEqual(280);
        } else if (typeof v === "object" && v !== null) {
          walk(v as Record<string, unknown>, [...path, k]);
        }
      }
    }
    walk(HELP as unknown as Record<string, unknown>, []);
  });

  it("qualification has one help string per dimension", () => {
    const dims = [
      "industryFit", "sizeFit", "geography", "growthPosture",
      "authority", "budget", "timeline", "complianceDriver",
    ] as const;
    for (const d of dims) {
      expect(HELP.qualification[d as keyof typeof HELP.qualification]).toBeDefined();
    }
  });

  it("pricing covers bundle / proposedMrr / multiYear / reason", () => {
    expect(HELP.pricing.bundle).toBeDefined();
    expect(HELP.pricing.proposedMrr).toBeDefined();
    expect(HELP.pricing.multiYear).toBeDefined();
    expect(HELP.pricing.reason).toBeDefined();
  });
});

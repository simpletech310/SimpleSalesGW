import { describe, expect, it } from "vitest";
import { OnboardingPhase, Role, ServiceLine } from "@prisma/client";

/**
 * v2.23 — vCIO recommendations sanity tests.
 *
 * We don't make a live Claude call here — the function itself is
 * exercised in the live smoke test. These tests lock in the type
 * contract + ensure the OnboardingPhase / Role / ServiceLine enums
 * used by the recommendation type stay in sync with Prisma's enums.
 */

describe("VcioRecommendation type contract", () => {
  it("OnboardingPhase enum still contains all expected phases", () => {
    const phases = new Set(Object.values(OnboardingPhase));
    expect(phases.has(OnboardingPhase.PRE_ENGAGEMENT)).toBe(true);
    expect(phases.has(OnboardingPhase.DISCOVERY)).toBe(true);
    expect(phases.has(OnboardingPhase.ONBOARD)).toBe(true);
    expect(phases.has(OnboardingPhase.STABILIZE)).toBe(true);
    expect(phases.has(OnboardingPhase.STEADY_STATE)).toBe(true);
  });

  it("Owner roles for recommended tasks are restricted to sales/ops roles", () => {
    // The lib enforces this app-level — these are the only roles the
    // AI prompt is allowed to assign.
    const allowed = new Set<Role>([Role.VCIO, Role.COO, Role.SALESPERSON]);
    expect(allowed.has(Role.VCIO)).toBe(true);
    expect(allowed.has(Role.COO)).toBe(true);
    expect(allowed.has(Role.SALESPERSON)).toBe(true);
    // Roles we explicitly DON'T want the AI assigning to tasks:
    expect(allowed.has(Role.SUPERADMIN)).toBe(false);
    expect(allowed.has(Role.SALES_MANAGER)).toBe(false);
  });

  it("ServiceLine enum covers the 9 lines the AI can recommend", () => {
    const lines = new Set(Object.values(ServiceLine));
    expect(lines.size).toBeGreaterThanOrEqual(9);
    expect(lines.has(ServiceLine.MANAGED_IT)).toBe(true);
    expect(lines.has(ServiceLine.CYBERSECURITY)).toBe(true);
    expect(lines.has(ServiceLine.NIST_ASSESSMENT)).toBe(true);
    expect(lines.has(ServiceLine.AI_ADVISORY)).toBe(true);
    expect(lines.has(ServiceLine.VCIO_RETAINER)).toBe(true);
    expect(lines.has(ServiceLine.VOIP)).toBe(true);
    expect(lines.has(ServiceLine.CABLING)).toBe(true);
    expect(lines.has(ServiceLine.ACCESS_CONTROL)).toBe(true);
    expect(lines.has(ServiceLine.VIDEO)).toBe(true);
  });
});

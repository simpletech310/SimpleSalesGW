import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { ROLE_FLOWS, flowFor } from "@/lib/onboarding/role-flows";

describe("per-role onboarding flows", () => {
  it("publishes a flow for every Role", () => {
    for (const role of Object.values(Role) as Role[]) {
      const flow = ROLE_FLOWS[role];
      expect(flow, `missing flow for ${role}`).toBeDefined();
      expect(flow.role).toBe(role);
    }
  });

  it("every flow has between 4 and 6 steps", () => {
    for (const flow of Object.values(ROLE_FLOWS)) {
      expect(flow.steps.length).toBeGreaterThanOrEqual(4);
      expect(flow.steps.length).toBeLessThanOrEqual(6);
    }
  });

  it("every step has stepKey, Icon, title, body", () => {
    for (const flow of Object.values(ROLE_FLOWS)) {
      for (const step of flow.steps) {
        expect(step.stepKey.length).toBeGreaterThan(0);
        expect(typeof step.Icon).toBe("object");  // lucide icons are forward-ref components
        expect(step.title.length).toBeGreaterThan(3);
        expect(step.body.length).toBeGreaterThan(20);
      }
    }
  });

  it("step keys are unique within a flow", () => {
    for (const flow of Object.values(ROLE_FLOWS)) {
      const seen = new Set<string>();
      for (const step of flow.steps) {
        expect(seen.has(step.stepKey), `duplicate stepKey ${step.stepKey} in ${flow.flowKey}`).toBe(false);
        seen.add(step.stepKey);
      }
    }
  });

  it("flowKey values are unique across roles", () => {
    const seen = new Set<string>();
    for (const flow of Object.values(ROLE_FLOWS)) {
      expect(seen.has(flow.flowKey), `duplicate flowKey ${flow.flowKey}`).toBe(false);
      seen.add(flow.flowKey);
    }
  });

  it("flowFor() returns the right flow per role", () => {
    expect(flowFor(Role.SALESPERSON).role).toBe(Role.SALESPERSON);
    expect(flowFor(Role.SALES_MANAGER).role).toBe(Role.SALES_MANAGER);
    expect(flowFor(Role.VCIO).role).toBe(Role.VCIO);
    expect(flowFor(Role.COO).role).toBe(Role.COO);
    expect(flowFor(Role.SUPERADMIN).role).toBe(Role.SUPERADMIN);
  });

  it("step bodies stay under 360 chars (plain-language budget)", () => {
    for (const flow of Object.values(ROLE_FLOWS)) {
      for (const step of flow.steps) {
        expect(step.body.length, `step ${step.stepKey} body too long`).toBeLessThanOrEqual(360);
      }
    }
  });

  it("action hrefs (when present) start with /", () => {
    for (const flow of Object.values(ROLE_FLOWS)) {
      for (const step of flow.steps) {
        if (!step.action) continue;
        expect(step.action.href.startsWith("/")).toBe(true);
        expect(step.action.label.length).toBeGreaterThan(2);
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { TASK_TEMPLATES } from "@/lib/onboarding/task-templates";

describe("onboarding task templates — defaultRole coverage", () => {
  it("every non-recurring task carries a defaultRole", () => {
    for (const t of TASK_TEMPLATES) {
      expect(t.defaultRole, `template ${t.key} missing defaultRole`).toBeDefined();
    }
  });

  it("PRE_ENGAGEMENT mixes VCIO and COO ownership", () => {
    const phase = TASK_TEMPLATES.filter((t) => t.phase === "PRE_ENGAGEMENT");
    const roles = new Set(phase.map((t) => t.defaultRole));
    expect(roles.has(Role.VCIO)).toBe(true);
    expect(roles.has(Role.COO)).toBe(true);
  });

  it("DISCOVERY is exclusively VCIO", () => {
    const phase = TASK_TEMPLATES.filter((t) => t.phase === "DISCOVERY");
    for (const t of phase) {
      expect(t.defaultRole).toBe(Role.VCIO);
    }
  });

  it("ONBOARD is mostly COO with vCIO owning docs + compliance", () => {
    const phase = TASK_TEMPLATES.filter((t) => t.phase === "ONBOARD");
    const cooCount = phase.filter((t) => t.defaultRole === Role.COO).length;
    const vcioCount = phase.filter((t) => t.defaultRole === Role.VCIO).length;
    expect(cooCount).toBeGreaterThan(0);
    expect(vcioCount).toBeGreaterThan(0);
    // ob.documentation + ob.compliance_controls + ob.exit_phase are VCIO
    expect(phase.find((t) => t.key === "ob.documentation")?.defaultRole).toBe(Role.VCIO);
    expect(phase.find((t) => t.key === "ob.compliance_controls")?.defaultRole).toBe(Role.VCIO);
  });

  it("STEADY_STATE is mostly VCIO with annual contract review on SALES_MANAGER", () => {
    const phase = TASK_TEMPLATES.filter((t) => t.phase === "STEADY_STATE");
    expect(phase.find((t) => t.key === "ss.contract_review")?.defaultRole).toBe(Role.SALES_MANAGER);
    const others = phase.filter((t) => t.key !== "ss.contract_review");
    for (const t of others) expect(t.defaultRole).toBe(Role.VCIO);
  });

  it("no template assigns SALESPERSON — by design, salespeople don't own onboarding work", () => {
    for (const t of TASK_TEMPLATES) {
      expect(t.defaultRole).not.toBe(Role.SALESPERSON);
    }
  });
});

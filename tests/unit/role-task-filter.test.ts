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

  it("STEADY_STATE includes annual contract review on SALES_MANAGER + recurring vCIO + salesperson renewal runway", () => {
    const phase = TASK_TEMPLATES.filter((t) => t.phase === "STEADY_STATE");
    expect(phase.find((t) => t.key === "ss.contract_review")?.defaultRole).toBe(Role.SALES_MANAGER);
    // v2.16 — salesperson now owns the renewal runway + QBR attendance
    expect(phase.find((t) => t.key === "sp.renewal_runway")?.defaultRole).toBe(Role.SALESPERSON);
    expect(phase.find((t) => t.key === "sp.qbr_attend")?.defaultRole).toBe(Role.SALESPERSON);
    // The classic recurring vCIO items still own everything else
    expect(phase.find((t) => t.key === "ss.qbr_followups")?.defaultRole).toBe(Role.VCIO);
    expect(phase.find((t) => t.key === "ss.roadmap_progress")?.defaultRole).toBe(Role.VCIO);
  });

  // v2.16 — explicit Salesperson + Sales Manager touchpoints across the
  // lifecycle so the relationship doesn't dead-drop after handoff.
  it("Salesperson now has multiple post-handoff touchpoints", () => {
    const spTasks = TASK_TEMPLATES.filter((t) => t.defaultRole === Role.SALESPERSON);
    expect(spTasks.length).toBeGreaterThanOrEqual(5);
    // Spans Pre-Engagement through Steady-State, not just one phase
    const phases = new Set(spTasks.map((t) => t.phase));
    expect(phases.size).toBeGreaterThanOrEqual(3);
  });

  it("Sales Manager has at least one in-flight scope review beyond the day-365 renewal", () => {
    const smTasks = TASK_TEMPLATES.filter((t) => t.defaultRole === Role.SALES_MANAGER);
    expect(smTasks.length).toBeGreaterThanOrEqual(2);
    expect(smTasks.some((t) => t.key === "sm.scope_review_30d")).toBe(true);
  });
});

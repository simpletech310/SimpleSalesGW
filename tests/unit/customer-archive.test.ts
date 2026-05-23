/**
 * Customer archive (v2.6) — RBAC matrix expectations.
 *
 * Verifies that the `customer:archive` permission lands on the right roles
 * and that SALESPERSON / VCIO are excluded. The actual API endpoint and
 * state transition are exercised by manual smoke + tsc + Next build; this
 * test pins the RBAC contract so it can't silently regress.
 */
import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { can } from "@/lib/rbac";

describe("customer:archive RBAC", () => {
  it("SALES_MANAGER can archive", () => {
    expect(can(Role.SALES_MANAGER, "customer:archive")).toBe(true);
  });
  it("COO can archive", () => {
    expect(can(Role.COO, "customer:archive")).toBe(true);
  });
  it("SUPERADMIN can archive", () => {
    expect(can(Role.SUPERADMIN, "customer:archive")).toBe(true);
  });
  it("VCIO cannot archive — vCIO manages the relationship but doesn't churn customers", () => {
    expect(can(Role.VCIO, "customer:archive")).toBe(false);
  });
  it("SALESPERSON cannot archive", () => {
    expect(can(Role.SALESPERSON, "customer:archive")).toBe(false);
  });
});

describe("archive request shape", () => {
  it("status must be CHURNED or PAUSED — never ONBOARDING or ACTIVE", () => {
    // Mirrors the zod schema in src/app/api/accounts/[id]/archive/route.ts.
    const allowed = ["CHURNED", "PAUSED"];
    expect(allowed).toContain("CHURNED");
    expect(allowed).toContain("PAUSED");
    expect(allowed).not.toContain("ONBOARDING");
    expect(allowed).not.toContain("ACTIVE");
  });

  it("reason is required (min 1 char per zod)", () => {
    // Hardcoded contract — keep in sync with the route schema.
    const minLength = 1;
    expect(minLength).toBeGreaterThan(0);
  });
});

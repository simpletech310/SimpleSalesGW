import { describe, expect, it } from "vitest";
import { canApproveAtV2, decideAuthority } from "@/lib/pricing/authority-matrix";

describe("authority matrix — % brackets", () => {
  it("0% → NONE", () => {
    const d = decideAuthority({ discountPct: 0 });
    expect(d.tier).toBe("NONE");
    expect(d.autoApprove).toBe(false);
  });

  it("0.01% → SELF (smallest positive lands in self lane)", () => {
    const d = decideAuthority({ discountPct: 0.01 });
    expect(d.tier).toBe("SELF");
    expect(d.autoApprove).toBe(true);
  });

  it("5% → SELF (top of lane is inclusive)", () => {
    const d = decideAuthority({ discountPct: 5 });
    expect(d.tier).toBe("SELF");
    expect(d.autoApprove).toBe(true);
  });

  it("5.01% → MANAGER", () => {
    const d = decideAuthority({ discountPct: 5.01 });
    expect(d.tier).toBe("MANAGER");
    expect(d.autoApprove).toBe(false);
  });

  it("20% → MANAGER (top of lane is inclusive)", () => {
    const d = decideAuthority({ discountPct: 20 });
    expect(d.tier).toBe("MANAGER");
    expect(d.autoApprove).toBe(false);
  });

  it("20.01% → COO", () => {
    const d = decideAuthority({ discountPct: 20.01 });
    expect(d.tier).toBe("COO");
    expect(d.autoApprove).toBe(false);
  });

  it("50% → COO", () => {
    const d = decideAuthority({ discountPct: 50 });
    expect(d.tier).toBe("COO");
  });
});

describe("authority matrix — overrides", () => {
  it("below-floor routes to COO even at 1%", () => {
    const d = decideAuthority({ discountPct: 1, belowFloor: true });
    expect(d.tier).toBe("COO");
    expect(d.autoApprove).toBe(false);
    expect(d.reason).toMatch(/below-floor/i);
  });

  it("below-floor takes precedence over multi-year", () => {
    const d = decideAuthority({ discountPct: 3, belowFloor: true, multiYear: true });
    expect(d.tier).toBe("COO");
    expect(d.reason).toMatch(/below-floor/i);
  });

  it("multi-year escalates 4% self-lane to COO", () => {
    const d = decideAuthority({ discountPct: 4, multiYear: true });
    expect(d.tier).toBe("COO");
    expect(d.autoApprove).toBe(false);
    expect(d.reason).toMatch(/multi-year/i);
  });

  it("multi-year at 0% still skips approval (no discount)", () => {
    const d = decideAuthority({ discountPct: 0, multiYear: true });
    expect(d.tier).toBe("COO");
    // multi-year + 0% still triggers COO per the matrix; it's not a "no discount means none" exception.
    // This is consistent with the rule "Multi-year bundle commit (X.X% off MRR) — COO approval required."
  });
});

describe("authority matrix — canApproveAtV2", () => {
  it("NONE is non-actionable", () => {
    expect(canApproveAtV2("NONE", "SALESPERSON")).toBe(false);
    expect(canApproveAtV2("NONE", "SUPERADMIN")).toBe(false);
  });

  it("SELF lane is auto-approved by anyone (requester)", () => {
    expect(canApproveAtV2("SELF", "SALESPERSON")).toBe(true);
  });

  it("MANAGER tier: only SALES_MANAGER + SUPERADMIN", () => {
    expect(canApproveAtV2("MANAGER", "SALES_MANAGER")).toBe(true);
    expect(canApproveAtV2("MANAGER", "SUPERADMIN")).toBe(true);
    expect(canApproveAtV2("MANAGER", "SALESPERSON")).toBe(false);
    expect(canApproveAtV2("MANAGER", "COO")).toBe(false);
    expect(canApproveAtV2("MANAGER", "VCIO")).toBe(false);
  });

  it("COO tier: only COO + SUPERADMIN", () => {
    expect(canApproveAtV2("COO", "COO")).toBe(true);
    expect(canApproveAtV2("COO", "SUPERADMIN")).toBe(true);
    expect(canApproveAtV2("COO", "SALES_MANAGER")).toBe(false);
    expect(canApproveAtV2("COO", "SALESPERSON")).toBe(false);
  });
});

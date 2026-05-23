import { describe, expect, it } from "vitest";
import { approvalTier, canApproveAt, discountPercent } from "@/lib/pricing";

describe("pricing helpers", () => {
  it("discountPercent computes correctly", () => {
    expect(discountPercent(100, 80)).toBe(20);
    expect(discountPercent(100, 100)).toBe(0);
    expect(discountPercent(100, 50)).toBe(50);
    expect(discountPercent(0, 0)).toBe(0);
    expect(discountPercent(1000, 750)).toBe(25);
  });

  it("discountPercent clamps negative (proposed > sticker)", () => {
    expect(discountPercent(100, 150)).toBe(0);
  });

  it("approvalTier routes to NONE/MANAGER/COO correctly", () => {
    expect(approvalTier(0)).toBe("NONE");
    expect(approvalTier(0.5)).toBe("MANAGER");
    expect(approvalTier(20)).toBe("MANAGER");
    expect(approvalTier(20.0001)).toBe("COO");
    expect(approvalTier(50)).toBe("COO");
  });

  it("canApproveAt respects roles", () => {
    expect(canApproveAt("NONE", "SALES_MANAGER")).toBe(false);
    expect(canApproveAt("MANAGER", "SALES_MANAGER")).toBe(true);
    expect(canApproveAt("MANAGER", "COO")).toBe(false);
    expect(canApproveAt("MANAGER", "SUPERADMIN")).toBe(true);
    expect(canApproveAt("COO", "COO")).toBe(true);
    expect(canApproveAt("COO", "SALES_MANAGER")).toBe(false);
    expect(canApproveAt("COO", "SUPERADMIN")).toBe(true);
  });
});

/**
 * Pricing approval helpers — tier routing and discount math.
 *
 * Rules (Section 10 RBAC):
 *   - 0% discount:   no approval needed.
 *   - >0% and <=20%: SALES_MANAGER (or SUPERADMIN) approves.
 *   - >20%:          COO (or SUPERADMIN) approves.
 */

import type { Role } from "@prisma/client";

export type ApprovalTier = "NONE" | "MANAGER" | "COO";

export function discountPercent(sticker: number, proposed: number): number {
  if (sticker <= 0) return 0;
  const pct = ((sticker - proposed) / sticker) * 100;
  return Math.max(0, Math.round(pct * 100) / 100);
}

export function approvalTier(discountPct: number): ApprovalTier {
  if (discountPct <= 0) return "NONE";
  if (discountPct <= 20) return "MANAGER";
  return "COO";
}

const TIER_ROLES: Record<Exclude<ApprovalTier, "NONE">, Role[]> = {
  MANAGER: ["SALES_MANAGER", "SUPERADMIN"],
  COO: ["COO", "SUPERADMIN"],
};

export function canApproveAt(tier: ApprovalTier, role: Role): boolean {
  if (tier === "NONE") return false;
  return TIER_ROLES[tier].includes(role);
}

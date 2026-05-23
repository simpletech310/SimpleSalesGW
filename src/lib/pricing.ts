/**
 * Pricing approval helpers — tier routing and discount math.
 *
 * Routing rules (v2.2 — per 07-Sales-and-Operations/01_Sales_Playbook.md):
 *   - 0% discount:    no approval needed.
 *   - >0% and <=5%:   SELF — salesperson auto-approves on submission.
 *   - >5% and <=20%:  SALES_MANAGER (or SUPERADMIN).
 *   - >20%:           COO (or SUPERADMIN).
 *   - below-floor:    COO regardless of discount %.
 *   - multi-year:     COO regardless of discount %.
 *
 * The v2-grade `decideAuthority()` in ./pricing/authority-matrix.ts is the
 * source of truth. This module keeps the legacy enum + helper around so older
 * callers (notifications inbox, etc.) keep compiling. New code should use the
 * authority-matrix module directly.
 */

import type { Role } from "@prisma/client";

export type ApprovalTier = "NONE" | "MANAGER" | "COO";

export function discountPercent(sticker: number, proposed: number): number {
  if (sticker <= 0) return 0;
  const pct = ((sticker - proposed) / sticker) * 100;
  return Math.max(0, Math.round(pct * 100) / 100);
}

/**
 * Legacy 3-bucket router (NONE | MANAGER | COO). Returns MANAGER for the new
 * SELF lane (≤5%) because those rows are auto-approved at create time; the
 * notifications inbox treats them as MANAGER queue items only if they
 * unexpectedly arrive in PENDING state (won't happen in normal flow).
 */
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

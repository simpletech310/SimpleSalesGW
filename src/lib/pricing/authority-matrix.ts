/**
 * Pricing authority matrix — v2.2 expansion.
 *
 * Maps a proposed discount + context to the role that owns the approval, with
 * an extra "self-approve under 5%" lane for salespeople so they don't have to
 * route trivial price moves through their manager.
 *
 * Routing rules (per 07-Sales-and-Operations/01_Sales_Playbook.md §Discount Authority):
 *   - 0%                : NONE     (no approval needed)
 *   - >0% and <=5%      : SELF     (salesperson auto-approves)
 *   - >5% and <=20%     : MANAGER  (SALES_MANAGER or SUPERADMIN)
 *   - >20%              : COO      (COO or SUPERADMIN)
 *   - below-floor MRR   : COO      (regardless of %)
 *   - multi-year bundle : COO      (regardless of %)
 */

import type { Role } from "@prisma/client";

export type ApprovalTierV2 = "NONE" | "SELF" | "MANAGER" | "COO";

export type AuthorityContext = {
  /** Percentage discount on MRR (0-100). */
  discountPct: number;
  /** True when the proposed MRR is below the bundle's published floor. */
  belowFloor?: boolean;
  /** True when the engagement is committed for >12 months at locked-in pricing. */
  multiYear?: boolean;
};

export type AuthorityDecision = {
  tier: ApprovalTierV2;
  /** True when the system can auto-approve (SELF lane). */
  autoApprove: boolean;
  /** Human-readable reason for the routing — written to AuditLog + Activity body. */
  reason: string;
};

const PCT_SELF_MAX = 5;     // <=5% → salesperson self-approves
const PCT_MANAGER_MAX = 20; // <=20% → sales manager

/**
 * Decide who must approve this pricing request.
 *
 * `autoApprove === true` means the requester themselves is authorized and the
 * row should be created in APPROVED state with the returned `reason` recorded
 * as the decision note.
 */
export function decideAuthority(ctx: AuthorityContext): AuthorityDecision {
  if (ctx.belowFloor) {
    return {
      tier: "COO",
      autoApprove: false,
      reason: `Below-floor pricing (${ctx.discountPct.toFixed(1)}% off MRR) — COO approval required regardless of discount %.`,
    };
  }
  if (ctx.multiYear) {
    return {
      tier: "COO",
      autoApprove: false,
      reason: `Multi-year bundle commit (${ctx.discountPct.toFixed(1)}% off MRR) — COO approval required.`,
    };
  }
  if (ctx.discountPct <= 0) {
    return { tier: "NONE", autoApprove: false, reason: "No discount requested." };
  }
  if (ctx.discountPct <= PCT_SELF_MAX) {
    return {
      tier: "SELF",
      autoApprove: true,
      reason: `Self-approved per Sales Playbook: ${ctx.discountPct.toFixed(1)}% off MRR is within the salesperson's authority (≤${PCT_SELF_MAX}%).`,
    };
  }
  if (ctx.discountPct <= PCT_MANAGER_MAX) {
    return {
      tier: "MANAGER",
      autoApprove: false,
      reason: `${ctx.discountPct.toFixed(1)}% off MRR — Sales Manager approval required (>${PCT_SELF_MAX}% and ≤${PCT_MANAGER_MAX}%).`,
    };
  }
  return {
    tier: "COO",
    autoApprove: false,
    reason: `${ctx.discountPct.toFixed(1)}% off MRR — COO approval required (>${PCT_MANAGER_MAX}%).`,
  };
}

const TIER_ROLES: Record<Exclude<ApprovalTierV2, "NONE" | "SELF">, Role[]> = {
  MANAGER: ["SALES_MANAGER", "SUPERADMIN"],
  COO: ["COO", "SUPERADMIN"],
};

/** True when `role` can act on a pending approval at `tier`. */
export function canApproveAtV2(tier: ApprovalTierV2, role: Role): boolean {
  if (tier === "NONE") return false;
  if (tier === "SELF") return true; // requester themselves
  return TIER_ROLES[tier].includes(role);
}

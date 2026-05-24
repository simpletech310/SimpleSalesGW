import { PipelineStage, Role, type Prisma } from "@prisma/client";

export type PermissionKey =
  | "lead:view:own"
  | "lead:view:all"
  | "lead:create"
  | "lead:edit:any"
  | "lead:edit:scope-notes"
  | "lead:delete"
  | "assessment:run"
  | "score:override"
  | "outreach:send"
  | "pricing:approve:5to20"
  | "pricing:approve:20plus"
  | "deal:approve:non-strategic"
  | "handoff:initiate"
  | "handoff:accept"
  | "pricing:view:sticker"
  | "pricing:view:floor"
  | "user:manage"
  | "audit:view"
  | "system:config"
  // v2.14 — pricing catalog edit (catalog itself, not per-deal approvals).
  // Granted to SUPERADMIN + SALES_MANAGER per user decision.
  | "pricing:catalog:edit"
  // v2.21 — MSP business profile editor (mission, voice, services
  // emphasis, win stories). Drives every Claude prompt; SUPERADMIN
  // only because misconfigured brand voice ships to every AI call.
  | "msp:profile:edit"
  | "data:export"
  // v2.0 — customer / vCIO portal
  | "customer:view:own"
  | "customer:view:all"
  | "discovery:run"
  | "discovery:edit"
  | "onboarding:manage"
  | "qbr:schedule"
  | "qbr:complete"
  | "customer:archive";

const matrix: Record<Role, ReadonlyArray<PermissionKey>> = {
  SALESPERSON: [
    "lead:view:own",
    "lead:create",
    "assessment:run",
    "outreach:send",
    "handoff:initiate",
    "pricing:view:sticker",
    "customer:view:own",
  ],
  SALES_MANAGER: [
    "lead:view:own",
    "lead:view:all",
    "lead:create",
    "lead:edit:any",
    "lead:delete",
    "assessment:run",
    "score:override",
    "outreach:send",
    "pricing:approve:5to20",
    "deal:approve:non-strategic",
    "handoff:initiate",
    "pricing:view:sticker",
    "pricing:view:floor",
    "pricing:catalog:edit",
    "data:export",
    "customer:view:own",
    "customer:view:all",
    "onboarding:manage",
    "customer:archive",
  ],
  VCIO: [
    "lead:view:own",
    "lead:view:all",
    "lead:edit:scope-notes",
    "customer:view:own",
    "customer:view:all",
    "discovery:run",
    "discovery:edit",
    "onboarding:manage",
    "qbr:schedule",
    "qbr:complete",
  ],
  COO: [
    "lead:view:own",
    "lead:view:all",
    "deal:approve:non-strategic",
    "handoff:accept",
    "pricing:approve:20plus",
    "pricing:view:sticker",
    "pricing:view:floor",
    "audit:view",
    "data:export",
    "customer:view:own",
    "customer:view:all",
    "onboarding:manage",
    "customer:archive",
  ],
  SUPERADMIN: [
    "lead:view:own",
    "lead:view:all",
    "lead:create",
    "lead:edit:any",
    "lead:delete",
    "assessment:run",
    "score:override",
    "outreach:send",
    "pricing:approve:5to20",
    "pricing:approve:20plus",
    "deal:approve:non-strategic",
    "handoff:initiate",
    "handoff:accept",
    "pricing:view:sticker",
    "pricing:view:floor",
    "user:manage",
    "audit:view",
    "system:config",
    "pricing:catalog:edit",
    "msp:profile:edit",
    "data:export",
    "customer:view:own",
    "customer:view:all",
    "discovery:run",
    "discovery:edit",
    "onboarding:manage",
    "qbr:schedule",
    "qbr:complete",
    "customer:archive",
  ],
};

export function can(role: Role | null | undefined, permission: PermissionKey): boolean {
  if (!role) return false;
  return matrix[role].includes(permission);
}

export function requirePermission(role: Role | null | undefined, permission: PermissionKey): void {
  if (!can(role, permission)) {
    throw new RbacError(`Missing permission: ${permission}`);
  }
}

export class RbacError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RbacError";
  }
}

/** Pipeline stages that vCIO is allowed to see. */
export const VCIO_VISIBLE_STAGES: PipelineStage[] = [
  PipelineStage.PRE_SALES,
  PipelineStage.PROPOSAL,
  PipelineStage.NEGOTIATION,
  PipelineStage.CLOSED_WON,
  PipelineStage.CLOSED_LOST,
];

/**
 * Central visibility helper — returns a Prisma where-input fragment that
 * captures the role's view scope. Compose with other `where` predicates.
 */
export function leadVisibilityFilter(role: Role, userId: string): Prisma.LeadWhereInput {
  if (role === Role.VCIO) {
    return { pipelineStage: { in: VCIO_VISIBLE_STAGES } };
  }
  if (!can(role, "lead:view:all")) {
    return { ownerUserId: userId };
  }
  return {};
}

/** True if the role+stage combination is visible to this user/lead. */
export function leadIsVisible(role: Role, userId: string, ownerUserId: string, stage: PipelineStage): boolean {
  if (role === Role.VCIO) return VCIO_VISIBLE_STAGES.includes(stage);
  if (can(role, "lead:view:all")) return true;
  return ownerUserId === userId;
}

// ---------------------------------------------------------------------------
// Customer (v2.0) visibility — Customer rows always derive from a Lead, so the
// rule mirrors lead visibility but is checked against the underlying lead's
// owner. vCIO sees all customers (regardless of stage — by the time a Lead
// becomes a Customer it's past PRE_SALES anyway).
// ---------------------------------------------------------------------------

export function customerVisibilityFilter(
  role: Role,
  userId: string,
): Prisma.CustomerWhereInput {
  if (can(role, "customer:view:all")) return {};
  // Otherwise: only customers whose lead is owned by the user
  return { lead: { ownerUserId: userId } };
}

export function canSeeCustomer(role: Role, userId: string, leadOwnerUserId: string): boolean {
  if (can(role, "customer:view:all")) return true;
  return leadOwnerUserId === userId;
}

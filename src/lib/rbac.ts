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
  // v2.22 — Sales-management surfaces
  | "team:manage"        // create/edit teams + territories + members
  | "sales-rep:create"   // create SALESPERSON-role user accounts (scoped)
  | "lead:assign"        // assign leads to teams or specific reps
  | "data:export"
  // v2.0 — customer / vCIO portal
  | "customer:view:own"
  | "customer:view:all"
  | "discovery:run"
  | "discovery:edit"
  | "onboarding:manage"
  | "qbr:schedule"
  | "qbr:complete"
  | "customer:archive"
  // v3.3 — SOP-alignment sweep
  | "proposal:draft"            // create / edit / send a proposal for own leads
  | "proposal:vcio-review"      // scope review gate
  | "proposal:manager-review"   // pricing review gate
  | "sow:template:edit"         // /admin/sow-templates CRUD
  | "kickoff:edit"              // edit kickoff record on customer (source-lead owner OR vCIO/COO)
  | "debrief:submit"            // submit deal debrief on CLOSED_WON/LOST
  // v3.4 — quote authoring is gated to manager + vCIO; reps request only
  | "quote:create"
  // v3.4 — vCIO accepts/rejects site surveys before discovery begins
  | "site-survey:accept";

const matrix: Record<Role, ReadonlyArray<PermissionKey>> = {
  SALESPERSON: [
    "lead:view:own",
    "lead:create",
    "assessment:run",
    "outreach:send",
    "handoff:initiate",
    "pricing:view:sticker",
    "customer:view:own",
    // v3.4 — reps no longer draft proposals; they request a quote from
    // manager/vCIO. proposal:draft removed.
    "kickoff:edit",
    "debrief:submit",
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
    // v2.22 — sales-management surfaces
    "team:manage",
    "sales-rep:create",
    "lead:assign",
    // v3.3
    "proposal:draft",
    "proposal:manager-review",
    "sow:template:edit",
    "kickoff:edit",
    "debrief:submit",
    // v3.4
    "quote:create",
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
    // v3.3
    "proposal:vcio-review",
    "kickoff:edit",
    // v3.4 — vCIO authors quotes after their assessment + accepts site surveys
    "proposal:draft",
    "quote:create",
    "site-survey:accept",
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
    // v3.3
    "kickoff:edit",
    // v3.4 — COO can also accept site surveys + author quotes if needed
    "quote:create",
    "site-survey:accept",
    "proposal:draft",
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
    // v2.22 — superadmin can do anything sales-manager can
    "team:manage",
    "sales-rep:create",
    "lead:assign",
    "data:export",
    "customer:view:own",
    "customer:view:all",
    "discovery:run",
    "discovery:edit",
    "onboarding:manage",
    "qbr:schedule",
    "qbr:complete",
    "customer:archive",
    // v3.3
    "proposal:draft",
    "proposal:vcio-review",
    "proposal:manager-review",
    "sow:template:edit",
    "kickoff:edit",
    "debrief:submit",
    // v3.4
    "quote:create",
    "site-survey:accept",
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
  // vCIO is pulled in once the sales rep schedules the site survey.
  PipelineStage.SITE_SURVEY_SCHEDULED,
  PipelineStage.DISCOVERY,
  PipelineStage.QUOTE_IN_PROGRESS,
  PipelineStage.QUOTE_SENT,
  PipelineStage.NEGOTIATION,
  PipelineStage.CLOSED_WON,
  PipelineStage.CLOSED_LOST,
];

/**
 * Central visibility helper — returns a Prisma where-input fragment that
 * captures the role's view scope. Compose with other `where` predicates.
 *
 * v2.22 — SALESPERSON now also sees leads assigned to any team they're
 * a member of (multi-team membership). Pass `userTeamIds` pre-fetched
 * via `userTeamIds()` from src/lib/sales/teams.ts so this stays sync.
 */
export function leadVisibilityFilter(
  role: Role,
  userId: string,
  userTeamIds: ReadonlyArray<string> = [],
): Prisma.LeadWhereInput {
  if (role === Role.VCIO) {
    return { pipelineStage: { in: VCIO_VISIBLE_STAGES } };
  }
  if (!can(role, "lead:view:all")) {
    // v2.22 — own OR on a team I'm in
    if (userTeamIds.length > 0) {
      return { OR: [{ ownerUserId: userId }, { teamId: { in: [...userTeamIds] } }] };
    }
    return { ownerUserId: userId };
  }
  return {};
}

/**
 * True if the role+stage combination is visible to this user/lead.
 *
 * v2.22 — pass `teamId` of the lead + `userTeamIds` of the viewer for
 * the team-membership check. When omitted, falls back to ownership-only
 * (backward-compatible with v2.21 call sites).
 */
export function leadIsVisible(
  role: Role,
  userId: string,
  ownerUserId: string,
  stage: PipelineStage,
  teamId: string | null = null,
  userTeamIds: ReadonlyArray<string> = [],
): boolean {
  if (role === Role.VCIO) return VCIO_VISIBLE_STAGES.includes(stage);
  if (can(role, "lead:view:all")) return true;
  if (ownerUserId === userId) return true;
  // v2.22 — team-membership grant
  if (teamId && userTeamIds.includes(teamId)) return true;
  return false;
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

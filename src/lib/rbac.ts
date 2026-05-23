import { Role } from "@prisma/client";

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
  | "data:export";

const matrix: Record<Role, ReadonlyArray<PermissionKey>> = {
  SALESPERSON: [
    "lead:view:own",
    "lead:create",
    "assessment:run",
    "outreach:send",
    "handoff:initiate",
    "pricing:view:sticker",
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
    "data:export",
  ],
  VCIO: [
    "lead:view:own",
    "lead:view:all",
    "lead:edit:scope-notes",
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
    "data:export",
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

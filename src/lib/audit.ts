import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@prisma/client";

export type AuditContext = {
  actorUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type AuditInput = AuditContext & {
  entityType: string;
  entityId: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
};

/**
 * Single point of audit truth. Every state-changing endpoint MUST call this.
 * Never throws back to the request path — auditing should not break the user flow,
 * but failures are logged for ops.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        before: (input.before ?? undefined) as never,
        after: (input.after ?? undefined) as never,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[audit] write failed", err);
  }
}

/** Diff helper — returns {before, after} containing only changed keys. */
export function diffForAudit<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): { before: Partial<T>; after: Partial<T> } {
  const beforeOut: Partial<T> = {};
  const afterOut: Partial<T> = {};
  for (const k of Object.keys(after) as (keyof T)[]) {
    if (before[k] !== after[k]) {
      beforeOut[k] = before[k];
      afterOut[k] = after[k];
    }
  }
  return { before: beforeOut, after: afterOut };
}

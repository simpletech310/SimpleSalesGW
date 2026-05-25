import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit, diffForAudit } from "@/lib/audit";

/**
 * Sales-rep management surface. Authorized for SUPERADMIN (via
 * user:manage) and SALES_MANAGER (via sales-rep:create), and only ever
 * operates on Users with role=SALESPERSON. Anything broader belongs in
 * /api/admin/users.
 */
const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  active: z.boolean().optional(),
});

function authorize(role: Role) {
  if (!can(role, "sales-rep:create") && !can(role, "user:manage")) {
    throw new ApiError(403, "Forbidden");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSessionUser();
    authorize(actor.role);
    const { id } = await params;
    const data = patchSchema.parse(await req.json());

    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "Not found");
    if (before.role !== Role.SALESPERSON) {
      throw new ApiError(403, "This endpoint only manages salespeople — open /admin/users for other roles");
    }

    const after = await prisma.user.update({ where: { id }, data });
    const diff = diffForAudit(
      before as unknown as Record<string, unknown>,
      data as unknown as Record<string, unknown>,
    );
    await writeAudit({
      actorUserId: actor.id,
      entityType: "User",
      entityId: id,
      action: "UPDATE",
      before: diff.before as never,
      after: diff.after as never,
      ...getAuditContext(req),
    });
    return NextResponse.json({ user: after });
  } catch (err) {
    return jsonError(err);
  }
}

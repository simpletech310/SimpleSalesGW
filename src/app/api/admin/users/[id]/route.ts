import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit, diffForAudit } from "@/lib/audit";

const schema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.nativeEnum(Role).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "user:manage")) throw new ApiError(403, "Forbidden");
    const { id } = await params;
    const data = schema.parse(await req.json());
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "Not found");
    const after = await prisma.user.update({ where: { id }, data });
    const diff = diffForAudit(before as unknown as Record<string, unknown>, data as unknown as Record<string, unknown>);
    await writeAudit({
      actorUserId: user.id,
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

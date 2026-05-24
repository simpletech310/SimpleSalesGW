import { NextResponse } from "next/server";
import { z } from "zod";
import { ServiceLine } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  serviceLines: z.array(z.nativeEnum(ServiceLine)).max(20).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "team:manage")) throw new ApiError(403, "Forbidden");
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const team = await prisma.salesTeam.update({
      where: { id },
      data: body,
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "SalesTeam",
      entityId: id,
      action: "UPDATE",
      after: body as never,
      ...getAuditContext(req),
    });

    return NextResponse.json({ team });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "team:manage")) throw new ApiError(403, "Forbidden");
    const { id } = await params;

    // Soft delete — flip active off rather than dropping the row. Lead
    // FKs are SetNull so leads stay around but become "unassigned team".
    const team = await prisma.salesTeam.update({
      where: { id },
      data: { active: false },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "SalesTeam",
      entityId: id,
      action: "DELETE",
      after: { active: false, name: team.name },
      ...getAuditContext(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

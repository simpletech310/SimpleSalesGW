import { NextResponse } from "next/server";
import { z } from "zod";
import { TeamRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const patchSchema = z.object({
  isPrimary: z.boolean().optional(),
  role: z.nativeEnum(TeamRole).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const actor = await requireSessionUser();
    if (!can(actor.role, "team:manage")) throw new ApiError(403, "Forbidden");
    const { id: teamId, userId } = await params;
    const data = patchSchema.parse(await req.json());

    const member = await prisma.salesTeamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) throw new ApiError(404, "Membership not found");

    // Only one team per user can be primary — if we're promoting this
    // membership, demote any other primary the user has.
    if (data.isPrimary === true) {
      await prisma.salesTeamMember.updateMany({
        where: { userId, isPrimary: true, NOT: { teamId } },
        data: { isPrimary: false },
      });
    }

    const after = await prisma.salesTeamMember.update({
      where: { teamId_userId: { teamId, userId } },
      data,
    });

    await writeAudit({
      actorUserId: actor.id,
      entityType: "SalesTeamMember",
      entityId: member.id,
      action: "UPDATE",
      before: { isPrimary: member.isPrimary, role: member.role } as never,
      after: { isPrimary: after.isPrimary, role: after.role } as never,
      ...getAuditContext(req),
    });

    return NextResponse.json({ member: after });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "team:manage")) throw new ApiError(403, "Forbidden");
    const { id: teamId, userId } = await params;

    const member = await prisma.salesTeamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) throw new ApiError(404, "Membership not found");

    await prisma.salesTeamMember.delete({
      where: { teamId_userId: { teamId, userId } },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "SalesTeamMember",
      entityId: member.id,
      action: "DELETE",
      after: { teamId, userId, wasPrimary: member.isPrimary },
      ...getAuditContext(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

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

import { NextResponse } from "next/server";
import { z } from "zod";
import { TeamRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const addSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(TeamRole).default(TeamRole.MEMBER),
  isPrimary: z.boolean().default(false),
});

/**
 * v2.22 — Add a member to a team.
 *
 * Reps can belong to multiple teams. If isPrimary=true, any other
 * primary memberships for this user are demoted (exactly one primary
 * per user).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "team:manage")) throw new ApiError(403, "Forbidden");
    const { id: teamId } = await params;
    const body = addSchema.parse(await req.json());

    // Verify team + user exist
    const [team, addedUser] = await Promise.all([
      prisma.salesTeam.findUnique({ where: { id: teamId }, select: { id: true, active: true } }),
      prisma.user.findUnique({ where: { id: body.userId }, select: { id: true, name: true, active: true } }),
    ]);
    if (!team) throw new ApiError(404, "Team not found");
    if (!addedUser || !addedUser.active) throw new ApiError(404, "User not found or inactive");

    // Demote any existing primary memberships if this one is marked primary
    if (body.isPrimary) {
      await prisma.salesTeamMember.updateMany({
        where: { userId: body.userId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const member = await prisma.salesTeamMember.upsert({
      where: { teamId_userId: { teamId, userId: body.userId } },
      update: { role: body.role, isPrimary: body.isPrimary },
      create: {
        teamId,
        userId: body.userId,
        role: body.role,
        isPrimary: body.isPrimary,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "SalesTeamMember",
      entityId: member.id,
      action: "CREATE",
      after: { teamId, userId: body.userId, role: body.role, isPrimary: body.isPrimary },
      ...getAuditContext(req),
    });

    return NextResponse.json({ member });
  } catch (err) {
    return jsonError(err);
  }
}

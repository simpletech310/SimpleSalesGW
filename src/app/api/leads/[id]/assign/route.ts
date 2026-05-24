import { NextResponse } from "next/server";
import { z } from "zod";
import { ActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

/**
 * v2.22 — PATCH /api/leads/[id]/assign
 * body: { teamId?: string | null, ownerUserId?: string }
 *
 * Reassign a lead to a team and/or specific rep. SALES_MANAGER + SUPERADMIN.
 * Writes an Activity row so the rep/manager sees the assignment change in
 * the activity stream.
 */
const schema = z.object({
  teamId: z.string().uuid().nullable().optional(),
  ownerUserId: z.string().uuid().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "lead:assign")) throw new ApiError(403, "Forbidden");
    const { id } = await params;
    const body = schema.parse(await req.json());

    const before = await prisma.lead.findUnique({
      where: { id },
      select: { teamId: true, ownerUserId: true },
    });
    if (!before) throw new ApiError(404, "Lead not found");

    // Validate new team + new owner exist
    if (body.teamId) {
      const team = await prisma.salesTeam.findUnique({ where: { id: body.teamId }, select: { name: true } });
      if (!team) throw new ApiError(404, "Team not found");
    }
    if (body.ownerUserId) {
      const owner = await prisma.user.findUnique({ where: { id: body.ownerUserId }, select: { active: true } });
      if (!owner || !owner.active) throw new ApiError(404, "Owner not found or inactive");
    }

    const data: Record<string, unknown> = {};
    if (body.teamId !== undefined) data.teamId = body.teamId;
    if (body.ownerUserId !== undefined) data.ownerUserId = body.ownerUserId;

    const lead = await prisma.lead.update({
      where: { id },
      data,
      include: {
        team: { select: { name: true } },
        owner: { select: { name: true } },
      },
    });

    // Activity row so it shows up in the lead's stream
    const noteParts: string[] = [];
    if (body.teamId !== undefined && body.teamId !== before.teamId) {
      noteParts.push(body.teamId ? `Assigned to team ${lead.team?.name ?? body.teamId}` : "Unassigned from team");
    }
    if (body.ownerUserId !== undefined && body.ownerUserId !== before.ownerUserId) {
      noteParts.push(`Reassigned to ${lead.owner.name}`);
    }
    if (noteParts.length > 0) {
      await prisma.activity.create({
        data: {
          leadId: id,
          actorUserId: user.id,
          type: ActivityType.STAGE_CHANGE,
          subject: noteParts.join(" · "),
          body: `Reassigned by ${user.name}`,
        },
      });
    }

    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: id,
      action: "UPDATE",
      after: {
        teamId: body.teamId,
        ownerUserId: body.ownerUserId,
        previousTeamId: before.teamId,
        previousOwnerUserId: before.ownerUserId,
      },
      ...getAuditContext(req),
    });

    return NextResponse.json({ lead });
  } catch (err) {
    return jsonError(err);
  }
}

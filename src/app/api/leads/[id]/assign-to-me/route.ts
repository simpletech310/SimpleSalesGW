import { NextResponse } from "next/server";
import { ActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

/**
 * v2.23.3 — POST /api/leads/[id]/assign-to-me
 *
 * Convenience wrapper around /api/leads/[id]/assign for the common
 * "claim this lead" flow. Mirrors the assign route's behavior but
 * fills in `ownerUserId` from the session so the client doesn't need
 * to know its own user id.
 *
 * RBAC: `lead:assign` (SALES_MANAGER + SUPERADMIN).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "lead:assign")) throw new ApiError(403, "Forbidden");
    const { id } = await params;

    const before = await prisma.lead.findUnique({
      where: { id },
      select: { ownerUserId: true },
    });
    if (!before) throw new ApiError(404, "Lead not found");
    if (before.ownerUserId === user.id) {
      return NextResponse.json({ ok: true, noChange: true });
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: { ownerUserId: user.id },
      include: { owner: { select: { name: true } } },
    });

    await prisma.activity.create({
      data: {
        leadId: id,
        actorUserId: user.id,
        type: ActivityType.STAGE_CHANGE,
        subject: `Reassigned to ${lead.owner.name}`,
        body: `${user.name} claimed this lead.`,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: id,
      action: "UPDATE",
      after: {
        ownerUserId: user.id,
        previousOwnerUserId: before.ownerUserId,
        reason: "self-assign",
      },
      ...getAuditContext(req),
    });

    return NextResponse.json({ lead });
  } catch (err) {
    return jsonError(err);
  }
}

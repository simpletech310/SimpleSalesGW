import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; proposalId: string }> }) {
  try {
    const actor = await requireSessionUser();
    if (!can(actor.role, "proposal:draft")) throw new ApiError(403, "Forbidden");
    const { proposalId } = await params;
    const proposal = await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: "VCIO_REVIEW" },
    });
    await writeAudit({
      actorUserId: actor.id,
      entityType: "Proposal",
      entityId: proposalId,
      action: "UPDATE",
      after: { status: "VCIO_REVIEW" } as never,
      ...getAuditContext(req),
    });
    return NextResponse.json({ proposal });
  } catch (err) {
    return jsonError(err);
  }
}

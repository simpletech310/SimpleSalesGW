import { NextResponse } from "next/server";
import { z } from "zod";
import { ReviewVerdict } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  verdict: z.nativeEnum(ReviewVerdict),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string; proposalId: string }> }) {
  try {
    const actor = await requireSessionUser();
    if (!can(actor.role, "proposal:manager-review")) throw new ApiError(403, "Forbidden");
    const { proposalId } = await params;
    const { verdict, notes } = schema.parse(await req.json());

    // Approve → APPROVED (ready to send); reject / changes → back to DRAFT
    const nextStatus = verdict === ReviewVerdict.APPROVED ? "APPROVED" : "DRAFT";

    const proposal = await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        managerReviewedAt: new Date(),
        managerReviewedById: actor.id,
        managerReviewVerdict: verdict,
        managerReviewNotes: notes,
        status: nextStatus,
      },
    });

    await writeAudit({
      actorUserId: actor.id,
      entityType: "Proposal",
      entityId: proposalId,
      action: verdict === ReviewVerdict.APPROVED ? "APPROVE" : "REJECT",
      after: { verdict, nextStatus } as never,
      ...getAuditContext(req),
    });

    return NextResponse.json({ proposal });
  } catch (err) {
    return jsonError(err);
  }
}

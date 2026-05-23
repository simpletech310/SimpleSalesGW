import { NextResponse } from "next/server";
import { z } from "zod";
import { PricingApprovalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { approvalTier, canApproveAt } from "@/lib/pricing";

const schema = z.object({ note: z.string().min(1).max(2000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const approval = await prisma.pricingApproval.findUnique({ where: { id } });
    if (!approval) throw new ApiError(404, "Pricing request not found");
    if (approval.status !== PricingApprovalStatus.PENDING) {
      throw new ApiError(409, `Already ${approval.status.toLowerCase()}`);
    }
    const tier = approvalTier(Number(approval.discountPct));
    if (!canApproveAt(tier, user.role)) {
      throw new ApiError(403, "Insufficient approval authority.");
    }
    const body = schema.parse(await req.json());
    const updated = await prisma.pricingApproval.update({
      where: { id },
      data: {
        status: PricingApprovalStatus.REJECTED,
        approverUserId: user.id,
        decidedAt: new Date(),
        decisionNote: body.note,
      },
    });
    await prisma.activity.create({
      data: {
        leadId: approval.leadId,
        actorUserId: user.id,
        type: "PROPOSAL_SENT",
        subject: `Pricing rejected (${Number(approval.discountPct).toFixed(1)}% off)`,
        body: body.note,
      },
    });
    await writeAudit({
      actorUserId: user.id,
      entityType: "PricingApproval",
      entityId: id,
      action: "REJECT",
      after: { status: "REJECTED", approverUserId: user.id, note: body.note },
      ...getAuditContext(req),
    });
    return NextResponse.json({ approval: updated });
  } catch (err) {
    return jsonError(err);
  }
}

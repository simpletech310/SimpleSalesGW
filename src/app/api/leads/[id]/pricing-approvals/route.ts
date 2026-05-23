import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, PricingApprovalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { approvalTier, discountPercent } from "@/lib/pricing";

const schema = z.object({
  stickerPrice: z.coerce.number().positive(),
  proposedPrice: z.coerce.number().nonnegative(),
  reason: z.string().min(1).max(2000),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const lead = await prisma.lead.findUnique({ where: { id }, select: { ownerUserId: true } });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (lead.ownerUserId !== user.id && !can(user.role, "lead:view:all")) {
      throw new ApiError(403, "Forbidden");
    }
    const approvals = await prisma.pricingApproval.findMany({
      where: { leadId: id },
      orderBy: { createdAt: "desc" },
      include: {
        requester: { select: { name: true } },
        approver: { select: { name: true } },
      },
    });
    return NextResponse.json({ approvals });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "lead:create") && user.role !== "SALES_MANAGER" && user.role !== "SUPERADMIN") {
      throw new ApiError(403, "Forbidden");
    }
    const { id } = await params;
    const data = schema.parse(await req.json());
    if (data.proposedPrice > data.stickerPrice) {
      throw new ApiError(400, "Proposed price exceeds sticker — no approval needed.");
    }
    const pct = discountPercent(data.stickerPrice, data.proposedPrice);
    if (approvalTier(pct) === "NONE") {
      throw new ApiError(400, "No discount — no approval needed.");
    }
    const approval = await prisma.pricingApproval.create({
      data: {
        leadId: id,
        requesterUserId: user.id,
        stickerPrice: new Prisma.Decimal(data.stickerPrice),
        proposedPrice: new Prisma.Decimal(data.proposedPrice),
        discountPct: new Prisma.Decimal(pct),
        reason: data.reason,
        status: PricingApprovalStatus.PENDING,
      },
    });
    await prisma.activity.create({
      data: {
        leadId: id,
        actorUserId: user.id,
        type: "PROPOSAL_SENT",
        subject: `Pricing approval requested (${pct.toFixed(1)}% off)`,
        body: data.reason,
      },
    });
    await writeAudit({
      actorUserId: user.id,
      entityType: "PricingApproval",
      entityId: approval.id,
      action: "CREATE",
      after: { leadId: id, discountPct: pct, tier: approvalTier(pct) },
      ...getAuditContext(req),
    });
    return NextResponse.json({ approval, tier: approvalTier(pct) }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

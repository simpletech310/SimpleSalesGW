import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, PricingApprovalStatus, ServiceBundle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { approvalTier, discountPercent } from "@/lib/pricing";
import { loadCatalog } from "@/lib/pricing/loader";
import { computeSticker, isBelowFloor } from "@/lib/pricing/catalog";

const schema = z.object({
  /** Which bundle this quote is for (matches Lead.suggestedBundle, but Lin can override). */
  bundleId: z.nativeEnum(ServiceBundle).optional(),
  /** Snapshot of seat count at quote time (defaults to Lead.seatCount). */
  seatCount: z.coerce.number().int().min(1).optional(),
  /** Monthly recurring revenue. */
  stickerMrr: z.coerce.number().nonnegative(),
  proposedMrr: z.coerce.number().nonnegative(),
  /** One-time onboarding fee (optional — CUSTOM scope-by-engagement leaves these null). */
  stickerOneTime: z.coerce.number().nonnegative().optional(),
  proposedOneTime: z.coerce.number().nonnegative().optional(),
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
    if (
      !can(user.role, "lead:create") &&
      user.role !== "SALES_MANAGER" &&
      user.role !== "SUPERADMIN"
    ) {
      throw new ApiError(403, "Forbidden");
    }
    const { id } = await params;
    const data = schema.parse(await req.json());

    if (data.proposedMrr > data.stickerMrr) {
      throw new ApiError(400, "Proposed MRR exceeds sticker — no approval needed.");
    }

    const pct = discountPercent(data.stickerMrr, data.proposedMrr);
    const oneTimeDiscount =
      (data.stickerOneTime ?? 0) > 0 && (data.proposedOneTime ?? 0) < (data.stickerOneTime ?? 0);
    if (pct === 0 && !oneTimeDiscount) {
      throw new ApiError(400, "No discount on MRR or onboarding — no approval needed.");
    }

    // Floor enforcement: if a bundle is named, compute its floor and flag below-floor.
    let belowFloor = false;
    if (data.bundleId && data.seatCount) {
      const catalog = await loadCatalog();
      const sticker = computeSticker(catalog, data.bundleId, data.seatCount);
      belowFloor = isBelowFloor(sticker, data.proposedMrr);
    }

    const approval = await prisma.pricingApproval.create({
      data: {
        leadId: id,
        requesterUserId: user.id,
        stickerPrice: new Prisma.Decimal(data.stickerMrr),
        proposedPrice: new Prisma.Decimal(data.proposedMrr),
        stickerOneTime: data.stickerOneTime !== undefined ? new Prisma.Decimal(data.stickerOneTime) : null,
        proposedOneTime: data.proposedOneTime !== undefined ? new Prisma.Decimal(data.proposedOneTime) : null,
        bundleId: data.bundleId ?? null,
        seatCount: data.seatCount ?? null,
        belowFloor,
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
        subject: `Pricing approval requested (${pct.toFixed(1)}% off MRR${belowFloor ? ", below floor" : ""})`,
        body: data.reason,
      },
    });

    // Effective routing tier — below-floor always escalates to COO.
    const tier = belowFloor ? "COO" : approvalTier(pct);

    await writeAudit({
      actorUserId: user.id,
      entityType: "PricingApproval",
      entityId: approval.id,
      action: "CREATE",
      after: {
        leadId: id,
        bundleId: data.bundleId ?? null,
        seatCount: data.seatCount ?? null,
        discountPct: pct,
        belowFloor,
        tier,
      },
      ...getAuditContext(req),
    });

    return NextResponse.json({ approval, tier, belowFloor }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

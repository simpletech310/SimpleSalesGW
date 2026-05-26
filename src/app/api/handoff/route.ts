import { NextResponse } from "next/server";
import { ActivityType, HandoffStatus, Prisma } from "@prisma/client";
import type { InputJsonValue } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { handoffInitiateSchema } from "@/lib/handoff/schema";

/**
 * POST /api/handoff — initiate a structured handoff (v2.3).
 *
 * Replaces the old freeform `payload` JSON with the paper-fidelity 60-field
 * checklist. All structured columns live on the Handoff model directly.
 */
export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "handoff:initiate")) throw new ApiError(403, "Forbidden");
    const data = handoffInitiateSchema.parse(await req.json());

    const lead = await prisma.lead.findUnique({ where: { id: data.leadId } });
    if (!lead) throw new ApiError(404, "Lead not found");
    // v2.8 defense-in-depth: only the owner (or someone with lead:edit:any)
    // can initiate a handoff on this lead.
    if (lead.ownerUserId !== user.id && !can(user.role, "lead:edit:any")) {
      throw new ApiError(403, "Forbidden — you don't own this lead.");
    }

    const handoff = await prisma.handoff.create({
      data: {
        leadId: data.leadId,
        initiatorUserId: user.id,
        status: HandoffStatus.INITIATED,
        dealValue: data.dealValue !== undefined ? new Prisma.Decimal(data.dealValue) : null,
        bundleId: data.bundleId ?? null,
        complianceOverlay: data.complianceOverlay ?? [],
        contractsSigned: data.contractsSigned ?? [],
        decisionMakers: (data.decisionMakers ?? []) as object,
        hardCommitments: (data.hardCommitments ?? []) as object,
        softCommitments: (data.softCommitments ?? []) as object,
        objectionsAndSkeptics: (data.objectionsAndSkeptics ?? []) as object,
        stakeholderContext: data.stakeholderContext ?? null,
        budgetSnapshot: (data.budgetSnapshot ?? Prisma.JsonNull) as unknown as InputJsonValue,
        successCriteria: (data.successCriteria ?? []) as object,
        statedPain: data.statedPain ?? null,
        day30QuickWin: data.day30QuickWin ?? null,
        notes: data.notes ?? null,
        initiatedAt: new Date(),
      },
    });

    await prisma.activity.create({
      data: {
        leadId: data.leadId,
        actorUserId: user.id,
        type: ActivityType.HANDOFF_INITIATED,
        subject: "Sales-to-Ops handoff initiated",
        body: data.notes ?? null,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "Handoff",
      entityId: handoff.id,
      action: "CREATE",
      after: {
        leadId: data.leadId,
        status: HandoffStatus.INITIATED,
        dealValue: data.dealValue ?? null,
        bundleId: data.bundleId ?? null,
        decisionMakerCount: data.decisionMakers?.length ?? 0,
        hardCommitmentCount: data.hardCommitments?.length ?? 0,
      },
      ...getAuditContext(req),
    });

    return NextResponse.json({ handoff }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

import { NextResponse } from "next/server";
import { ActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

/**
 * Sales rep requests a quote from a manager/vCIO. We log this as an
 * Activity row on the lead (so the SOP timeline shows the ask) and write
 * an audit entry so the queue page can surface it.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, ownerUserId: true, businessName: true, pipelineStage: true },
    });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (lead.ownerUserId !== user.id) {
      throw new ApiError(403, "Only the lead owner can request a quote.");
    }

    await prisma.activity.create({
      data: {
        leadId: id,
        actorUserId: user.id,
        type: ActivityType.NOTE,
        subject: "Quote requested",
        body: "Sales rep has requested a quote. A Sales Manager or vCIO should author the SOW from the Proposal tab.",
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: id,
      action: "UPDATE",
      after: { event: "QUOTE_REQUESTED", leadName: lead.businessName },
      ...getAuditContext(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

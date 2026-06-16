import { NextResponse } from "next/server";
import { z } from "zod";
import { SiteSurveyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

// v3.7 — vCIO asks the rep for a new date/time without rejecting the survey on
// quality grounds. Bounces it back to the rep; a material PATCH re-queues it.
const schema = z.object({
  reason: z.string().min(3, "Add a short note so the rep knows what to reschedule (e.g. preferred days/times)."),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "site-survey:accept")) {
      throw new ApiError(403, "Only vCIO or COO can request a reschedule.");
    }
    const { id } = await params;
    const { reason } = schema.parse(await req.json());
    const survey = await prisma.siteSurvey.findUnique({ where: { leadId: id } });
    if (!survey) throw new ApiError(404, "Site survey not found");

    const updated = await prisma.siteSurvey.update({
      where: { id: survey.id },
      data: {
        status: SiteSurveyStatus.RESCHEDULE_REQUESTED,
        rescheduleRequestedAt: new Date(),
        rescheduleNote: reason,
        vcioAcceptedAt: null,
        vcioRejectedAt: null,
        vcioRejectReason: null,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "SiteSurvey",
      entityId: survey.id,
      action: "UPDATE",
      before: { status: survey.status },
      after: { status: updated.status, rescheduleNote: reason },
      ...getAuditContext(req),
    });

    return NextResponse.json({ siteSurvey: updated });
  } catch (err) {
    return jsonError(err);
  }
}

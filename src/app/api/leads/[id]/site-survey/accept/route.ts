import { NextResponse } from "next/server";
import { SiteSurveyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "site-survey:accept")) throw new ApiError(403, "Only vCIO or COO can accept a site survey.");
    const { id } = await params;
    const survey = await prisma.siteSurvey.findUnique({ where: { leadId: id } });
    if (!survey) throw new ApiError(404, "Site survey not found");

    const updated = await prisma.siteSurvey.update({
      where: { id: survey.id },
      data: {
        status: SiteSurveyStatus.ACCEPTED,
        vcioAcceptedAt: new Date(),
        vcioRejectedAt: null,
        vcioRejectReason: null,
        // Pin this vCIO as the owner of the visit if not already set.
        vcioUserId: survey.vcioUserId ?? user.id,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "SiteSurvey",
      entityId: survey.id,
      action: "UPDATE",
      before: { status: survey.status },
      after: { status: updated.status, vcioAcceptedAt: updated.vcioAcceptedAt },
      ...getAuditContext(req),
    });

    return NextResponse.json({ siteSurvey: updated });
  } catch (err) {
    return jsonError(err);
  }
}

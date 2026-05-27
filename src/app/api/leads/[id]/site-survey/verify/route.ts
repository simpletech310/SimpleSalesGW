import { NextResponse } from "next/server";
import { z } from "zod";
import { SiteSurveyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

// vCIO marks the on-site assessment complete and records verified head counts.
// Required gate before the lead can advance from DISCOVERY → QUOTE_IN_PROGRESS.
const schema = z.object({
  verifiedSeatCount: z.number().int().min(0),
  verifiedSiteCount: z.number().int().min(1),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "site-survey:accept")) {
      throw new ApiError(403, "Only vCIO or COO can verify discovery data.");
    }
    const { id } = await params;
    const { verifiedSeatCount, verifiedSiteCount } = schema.parse(await req.json());
    const survey = await prisma.siteSurvey.findUnique({ where: { leadId: id } });
    if (!survey) throw new ApiError(404, "Site survey not found");

    const updated = await prisma.siteSurvey.update({
      where: { id: survey.id },
      data: {
        verifiedSeatCount,
        verifiedSiteCount,
        discoveryVerifiedAt: new Date(),
        completedAt: survey.completedAt ?? new Date(),
        status: SiteSurveyStatus.COMPLETED,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "SiteSurvey",
      entityId: survey.id,
      action: "UPDATE",
      before: {
        verifiedSeatCount: survey.verifiedSeatCount,
        verifiedSiteCount: survey.verifiedSiteCount,
      },
      after: {
        verifiedSeatCount,
        verifiedSiteCount,
        discoveryVerifiedAt: updated.discoveryVerifiedAt,
      },
      ...getAuditContext(req),
    });

    return NextResponse.json({ siteSurvey: updated });
  } catch (err) {
    return jsonError(err);
  }
}

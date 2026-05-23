import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { autoScoreQualification } from "@/lib/qualification/auto-score";

/**
 * GET /api/leads/[id]/qualification/auto-score
 * Returns a recommended 8-dimension scorecard derived from the lead's existing
 * fields. Lin can apply it as a baseline and then hand-tune.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: {
        ownerUserId: true,
        industry: true,
        seatCount: true,
        addressCity: true,
        addressState: true,
        executiveSponsorName: true,
        currentMspSatisfaction: true,
        cyberInsuranceRenewalDate: true,
        complianceDrivers: true,
      },
    });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (lead.ownerUserId !== user.id && !can(user.role, "lead:view:all")) {
      throw new ApiError(403, "Forbidden");
    }
    const auto = autoScoreQualification(lead);
    return NextResponse.json({ auto });
  } catch (err) {
    return jsonError(err);
  }
}

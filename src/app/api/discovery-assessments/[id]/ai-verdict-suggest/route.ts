import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { suggestAssessmentVerdict } from "@/lib/ai/assessment-verdict";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSessionUser();
    if (!can(actor.role, "proposal:vcio-review") && !can(actor.role, "discovery:edit")) {
      throw new ApiError(403, "Forbidden");
    }
    const { id } = await params;
    const a = await prisma.discoveryAssessment.findUnique({
      where: { id },
      include: {
        lead: { select: { businessName: true, industry: true, seatCount: true, complianceDrivers: true } },
      },
    });
    if (!a) throw new ApiError(404, "Not found");
    if (!a.lead) throw new ApiError(400, "Assessment not attached to a lead");

    const result = await suggestAssessmentVerdict(
      {
        lead: a.lead,
        assessment: {
          kind: a.kind,
          answers: (a.answers ?? {}) as Record<string, unknown>,
          scorecard: a.scorecard as Record<string, unknown> | null,
        },
      },
      a.leadId ? { leadId: a.leadId, userId: actor.id } : undefined,
    );
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}

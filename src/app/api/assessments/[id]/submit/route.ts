import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { submitAssessment } from "@/lib/assessment/submit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;

    // v2.8 defense-in-depth: only the assessment creator, the lead owner,
    // or someone with lead:edit:any can submit. (Self-service respondents
    // post to /api/assessments/respond/[token]/submit, which has its own
    // token-based auth.)
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: { lead: { select: { ownerUserId: true } } },
    });
    if (!assessment) throw new ApiError(404, "Assessment not found");
    const isCreator = assessment.createdByUserId === user.id;
    const isOwner = assessment.lead.ownerUserId === user.id;
    if (!isCreator && !isOwner && !can(user.role, "lead:edit:any")) {
      throw new ApiError(403, "Forbidden — you can't submit this assessment.");
    }

    const { scoring } = await submitAssessment(id, {
      actorUserId: user.id,
      ...getAuditContext(req),
    });
    return NextResponse.json({ scoring });
  } catch (err) {
    return jsonError(err);
  }
}

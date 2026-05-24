import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";

const schema = z.object({
  questionId: z.string().min(1).max(20),
  answerValue: z.any(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const data = schema.parse(await req.json());
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: { lead: { select: { ownerUserId: true } } },
    });
    if (!assessment) throw new ApiError(404, "Assessment not found");

    // v2.8 defense-in-depth: only the assessment creator, the lead owner,
    // or someone with lead:edit:any can write answers. (Self-service
    // respondents post to /api/assessments/respond/[token]/answer, which
    // has its own token-based auth.)
    const isCreator = assessment.createdByUserId === user.id;
    const isOwner = assessment.lead.ownerUserId === user.id;
    if (!isCreator && !isOwner && !can(user.role, "lead:edit:any")) {
      throw new ApiError(403, "Forbidden — you can't edit this assessment.");
    }

    await prisma.assessmentAnswer.upsert({
      where: { assessmentId_questionId: { assessmentId: id, questionId: data.questionId } },
      update: { answerValue: data.answerValue },
      create: { assessmentId: id, questionId: data.questionId, answerValue: data.answerValue },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

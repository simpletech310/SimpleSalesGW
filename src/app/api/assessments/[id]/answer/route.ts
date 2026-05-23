import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";

const schema = z.object({
  questionId: z.string().min(1).max(20),
  answerValue: z.any(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const data = schema.parse(await req.json());
    const assessment = await prisma.assessment.findUnique({ where: { id } });
    if (!assessment) throw new ApiError(404, "Assessment not found");
    void user;
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

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { resolveToken } from "@/lib/assessment/tokens";

const schema = z.object({
  questionId: z.string().min(1).max(20),
  answerValue: z.any(),
});

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const res = await resolveToken(token);
    if (!res.ok) {
      return NextResponse.json({ error: res.reason }, { status: 410 });
    }
    const data = schema.parse(await req.json());
    await prisma.assessmentAnswer.upsert({
      where: { assessmentId_questionId: { assessmentId: res.assessmentId, questionId: data.questionId } },
      update: { answerValue: data.answerValue },
      create: { assessmentId: res.assessmentId, questionId: data.questionId, answerValue: data.answerValue },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

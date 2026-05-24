import { NextResponse } from "next/server";
import { z } from "zod";
import { DiscoveryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";

/**
 * v2.17 — Per-question autosave for a lead-scoped (pre-sale) discovery
 * assessment. Mirror of the customer-scoped /answer route.
 */

const schema = z.object({ questionId: z.string().min(1).max(20), answerValue: z.any() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string; assessmentId: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "discovery:edit")) throw new ApiError(403, "Forbidden");
    const { id: leadId, assessmentId } = await params;
    const data = schema.parse(await req.json());

    const a = await prisma.discoveryAssessment.findUnique({ where: { id: assessmentId } });
    if (!a || a.leadId !== leadId) throw new ApiError(404, "Assessment not found");
    if (a.status === DiscoveryStatus.COMPLETED) throw new ApiError(409, "Assessment already completed");

    const currentAnswers = (a.answers as Record<string, unknown>) ?? {};
    const updated = { ...currentAnswers, [data.questionId]: data.answerValue };

    await prisma.discoveryAssessment.update({
      where: { id: assessmentId },
      data: {
        answers: updated as never,
        status: DiscoveryStatus.IN_PROGRESS,
        // Stamp startedAt the first time an answer lands.
        startedAt: a.startedAt ?? new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

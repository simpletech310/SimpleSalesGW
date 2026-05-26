import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { recapPain } from "@/lib/ai/handoff-pain-recap";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSessionUser();
    if (!can(actor.role, "handoff:initiate")) throw new ApiError(403, "Forbidden");
    const { id: leadId } = await params;
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { businessName: true, industry: true },
    });
    if (!lead) throw new ApiError(404, "Not found");
    const [discoveries, activities] = await Promise.all([
      prisma.discoveryAssessment.findMany({
        where: { leadId, status: "COMPLETED" },
        select: { kind: true, scorecard: true },
        take: 5,
      }),
      prisma.activity.findMany({
        where: { leadId },
        orderBy: { createdAt: "desc" },
        select: { subject: true, body: true },
        take: 20,
      }),
    ]);

    const activityQuotes = activities
      .flatMap((a) => [a.subject, a.body].filter((s): s is string => Boolean(s)))
      .slice(0, 12);

    const result = await recapPain(
      {
        lead,
        discoveryHighlights: discoveries.map((d) => `${d.kind}: ${JSON.stringify(d.scorecard ?? {}).slice(0, 300)}`),
        activityQuotes,
      },
      { leadId, userId: actor.id },
    );
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}

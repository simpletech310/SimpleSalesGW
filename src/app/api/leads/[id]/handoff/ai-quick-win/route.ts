import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { suggestDay30Win } from "@/lib/ai/handoff-quick-win";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSessionUser();
    if (!can(actor.role, "handoff:initiate")) throw new ApiError(403, "Forbidden");
    const { id: leadId } = await params;
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        businessName: true, industry: true, seatCount: true,
        complianceDrivers: true, suggestedBundle: true,
      },
    });
    if (!lead) throw new ApiError(404, "Not found");
    const discoveries = await prisma.discoveryAssessment.findMany({
      where: { leadId, status: "COMPLETED" },
      select: { kind: true, scorecard: true },
      take: 5,
    });
    const result = await suggestDay30Win(
      {
        lead,
        bundle: lead.suggestedBundle,
        statedPain: null,
        discoveryHighlights: discoveries.map((d) => `${d.kind}: ${JSON.stringify(d.scorecard ?? {}).slice(0, 300)}`),
      },
      { leadId, userId: actor.id },
    );
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}

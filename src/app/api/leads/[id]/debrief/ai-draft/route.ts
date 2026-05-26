import { NextResponse } from "next/server";
import { z } from "zod";
import { PipelineStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { draftDebrief } from "@/lib/ai/debrief-draft";

const bodySchema = z.object({
  outcome: z.enum([PipelineStage.CLOSED_WON, PipelineStage.CLOSED_LOST]),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSessionUser();
    if (!can(actor.role, "debrief:submit")) throw new ApiError(403, "Forbidden");
    const { id: leadId } = await params;
    const { outcome } = bodySchema.parse(await req.json());

    const [lead, activities, objections, pricing, discoveries] = await Promise.all([
      prisma.lead.findUnique({
        where: { id: leadId },
        select: { businessName: true, industry: true, pipelineStage: true, closedLostReason: true },
      }),
      prisma.activity.findMany({
        where: { leadId },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { type: true, subject: true, outcome: true, createdAt: true },
      }),
      prisma.objectionLog.findMany({
        where: { leadId },
        select: { category: true, text: true, outcome: true },
        take: 20,
      }),
      prisma.pricingApproval.findMany({
        where: { leadId },
        select: { status: true, discountPct: true, reason: true, belowFloor: true },
        take: 10,
      }),
      prisma.discoveryAssessment.findMany({
        where: { leadId, status: "COMPLETED" },
        select: { kind: true, scorecard: true },
        take: 5,
      }),
    ]);

    if (!lead) throw new ApiError(404, "Not found");

    const result = await draftDebrief(
      {
        lead,
        outcome,
        activities: activities.map((a) => ({
          type: a.type,
          subject: a.subject,
          outcome: a.outcome,
          createdAt: a.createdAt.toISOString(),
        })),
        objections: objections.map((o) => ({
          category: o.category,
          trigger: o.text,
          resolved: o.outcome === "RESOLVED",
        })),
        pricingApprovals: pricing.map((p) => ({
          tier: p.belowFloor ? "COO" : "MANAGER",
          status: p.status,
          discountPct: Number(p.discountPct),
          reason: p.reason,
        })),
        discoveryHighlights: discoveries.map((d) => `${d.kind}: ${JSON.stringify(d.scorecard ?? {}).slice(0, 300)}`),
      },
      { leadId, userId: actor.id },
    );

    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}

import { NextResponse } from "next/server";
import { DiscoveryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { scoreDiscovery } from "@/lib/discovery/scoring";

/**
 * v2.17 — Complete a lead-scoped (pre-sale) DiscoveryAssessment.
 * Mirror of the customer-scoped /complete route — runs scoreDiscovery
 * which now emits recommendedLineItems[] for the salesperson to adopt.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; assessmentId: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "discovery:edit")) throw new ApiError(403, "Forbidden");
    const { id: leadId, assessmentId } = await params;

    const a = await prisma.discoveryAssessment.findUnique({ where: { id: assessmentId } });
    if (!a || a.leadId !== leadId) throw new ApiError(404, "Assessment not found");

    const scorecard = scoreDiscovery(a.kind, (a.answers as Record<string, unknown>) ?? {});

    const updated = await prisma.discoveryAssessment.update({
      where: { id: assessmentId },
      data: {
        status: DiscoveryStatus.COMPLETED,
        completedAt: new Date(),
        scorecard: scorecard as never,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "DiscoveryAssessment",
      entityId: assessmentId,
      action: "UPDATE",
      before: { status: a.status },
      after: { status: DiscoveryStatus.COMPLETED, kind: a.kind, scope: "pre-sale" },
      ...getAuditContext(req),
    });

    return NextResponse.json({ assessment: updated, scorecard });
  } catch (err) {
    return jsonError(err);
  }
}

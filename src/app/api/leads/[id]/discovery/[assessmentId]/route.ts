import { NextResponse } from "next/server";
import { DiscoveryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

/**
 * v3.3.3 — Cancel a lead-scoped (pre-sale) DiscoveryAssessment.
 *
 * Hard-delete when status is NOT_STARTED or IN_PROGRESS — the row is
 * just an open request. COMPLETED assessments carry scorecard + AI plan
 * snapshots and are refused (preserving audit trail and adopt-into-quote
 * history). Allowed for: the original requester, anyone with
 * `discovery:edit` (VCIO + SUPERADMIN), or anyone with `lead:edit:any`
 * (SALES_MANAGER + SUPERADMIN).
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; assessmentId: string }> },
) {
  try {
    const user = await requireSessionUser();
    const { id: leadId, assessmentId } = await params;

    const a = await prisma.discoveryAssessment.findUnique({
      where: { id: assessmentId },
      select: { id: true, leadId: true, status: true, kind: true, createdByUserId: true },
    });
    if (!a || a.leadId !== leadId) throw new ApiError(404, "Assessment not found");

    const isOwner = a.createdByUserId === user.id;
    const canCancel = isOwner || can(user.role, "discovery:edit") || can(user.role, "lead:edit:any");
    if (!canCancel) throw new ApiError(403, "Forbidden");

    if (a.status === DiscoveryStatus.COMPLETED) {
      throw new ApiError(
        409,
        "This assessment is already completed — its scorecard and any adopted line items are preserved. Open a new request instead.",
      );
    }

    await prisma.discoveryAssessment.delete({ where: { id: assessmentId } });

    await writeAudit({
      actorUserId: user.id,
      entityType: "DiscoveryAssessment",
      entityId: assessmentId,
      action: "DELETE",
      before: { status: a.status, kind: a.kind, scope: "pre-sale" },
      ...getAuditContext(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

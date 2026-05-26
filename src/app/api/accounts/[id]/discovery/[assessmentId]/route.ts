import { NextResponse } from "next/server";
import { DiscoveryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

/**
 * v3.3.6 — Reopen a COMPLETED customer-scoped assessment for editing.
 * Same shape as the lead-side variant.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; assessmentId: string }> },
) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "discovery:edit")) throw new ApiError(403, "Forbidden");
    const { id: customerId, assessmentId } = await params;

    const body = await req.json().catch(() => ({}));
    const action = (body as { action?: string })?.action;
    if (action !== "reopen") {
      throw new ApiError(400, "Unsupported action. Use { action: 'reopen' }.");
    }

    const a = await prisma.discoveryAssessment.findUnique({
      where: { id: assessmentId },
      select: { id: true, customerId: true, status: true, kind: true },
    });
    if (!a || a.customerId !== customerId) throw new ApiError(404, "Assessment not found");

    if (a.status !== DiscoveryStatus.COMPLETED) {
      throw new ApiError(409, "Only completed assessments can be reopened.");
    }

    await prisma.discoveryAssessment.update({
      where: { id: assessmentId },
      data: { status: DiscoveryStatus.IN_PROGRESS, completedAt: null },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "DiscoveryAssessment",
      entityId: assessmentId,
      action: "UPDATE",
      before: { status: a.status },
      after: { status: DiscoveryStatus.IN_PROGRESS, reason: "reopen-for-edit" },
      ...getAuditContext(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

/**
 * v3.3.3 — Cancel a customer-scoped DiscoveryAssessment.
 *
 * Same rules as the lead-side delete: hard-remove when NOT_STARTED or
 * IN_PROGRESS; refuse on COMPLETED to keep scorecard + plan snapshots
 * intact. Customer-side discoveries don't have a salesperson "owner" in
 * the same sense, so cancellation requires `discovery:edit` (VCIO +
 * SUPERADMIN) — the people who actually run them.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; assessmentId: string }> },
) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "discovery:edit")) throw new ApiError(403, "Forbidden");
    const { id: customerId, assessmentId } = await params;

    const a = await prisma.discoveryAssessment.findUnique({
      where: { id: assessmentId },
      select: { id: true, customerId: true, status: true, kind: true },
    });
    if (!a || a.customerId !== customerId) throw new ApiError(404, "Assessment not found");

    if (a.status === DiscoveryStatus.COMPLETED) {
      throw new ApiError(
        409,
        "This assessment is already completed — its scorecard and any accepted plan are preserved.",
      );
    }

    await prisma.discoveryAssessment.delete({ where: { id: assessmentId } });

    await writeAudit({
      actorUserId: user.id,
      entityType: "DiscoveryAssessment",
      entityId: assessmentId,
      action: "DELETE",
      before: { status: a.status, kind: a.kind, scope: "customer" },
      ...getAuditContext(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

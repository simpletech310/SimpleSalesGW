import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

/**
 * v2.18 — One-shot destructive purge of every Lead row.
 *
 * Cascades take care of every Lead-dependent child row (Activity, Note,
 * Assessment, ServiceMatch, ResearchArtifact, Handoff, Attachment,
 * PricingApproval, SignedDocument, QualificationScorecard,
 * DiscoveryCallNote, ObjectionLog, DiscoveryAssessment, and any Customer
 * whose leadId points to a deleted lead) per schema.prisma's
 * `onDelete: Cascade` annotations.
 *
 * Gated to SUPERADMIN only — destructive and irreversible. The intended
 * workflow is to clear the demo / test data and then bulk-import the
 * Burbank prospect shortlist via the existing import button.
 *
 * Audit row written so the operation is forever traceable.
 */
export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "user:manage")) {
      throw new ApiError(403, "Forbidden — Superadmin only");
    }

    const before = await prisma.lead.count();
    const customersBefore = await prisma.customer.count();

    const res = await prisma.lead.deleteMany({});

    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: "all",
      action: "DELETE",
      before: { totalLeads: before, totalCustomers: customersBefore },
      after: { deletedLeads: res.count },
      ...getAuditContext(req),
    });

    return NextResponse.json({
      ok: true,
      deletedLeads: res.count,
      totalBefore: before,
      cascadedCustomers: customersBefore, // not the exact post-count, but the upper bound
    });
  } catch (err) {
    return jsonError(err);
  }
}

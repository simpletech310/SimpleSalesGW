import { NextResponse } from "next/server";
import { HandoffStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { createCustomerFromHandoff } from "@/lib/customer/create-from-handoff";

/**
 * v2.15.2 — Bulk recovery for orphaned accepted handoffs.
 *
 * Finds every Handoff with status=ACCEPTED whose Lead has no Customer row,
 * and runs createCustomerFromHandoff for each. Designed to be safe to run
 * over and over — calling for a lead that already has a customer is a no-op.
 *
 * Surfaced from /admin/setup as a "Fix orphaned accounts" button.
 * Gated by user:manage or pricing:catalog:edit (Sales Manager + Superadmin).
 */
export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "user:manage") && !can(user.role, "pricing:catalog:edit")) {
      throw new ApiError(403, "Forbidden");
    }

    // Find all accepted handoffs whose lead has no customer.
    const orphans = await prisma.handoff.findMany({
      where: {
        status: HandoffStatus.ACCEPTED,
        lead: { customer: { is: null } },
      },
      select: {
        id: true,
        leadId: true,
        acceptorUserId: true,
        lead: { select: { businessName: true } },
      },
    });

    const results: Array<{ handoffId: string; leadId: string; businessName: string; customerId: string | null; error: string | null }> = [];
    for (const h of orphans) {
      try {
        const customer = await createCustomerFromHandoff({
          leadId: h.leadId,
          acceptedByUserId: h.acceptorUserId ?? user.id,
        });
        results.push({
          handoffId: h.id,
          leadId: h.leadId,
          businessName: h.lead.businessName,
          customerId: customer.id,
          error: null,
        });
      } catch (err) {
        results.push({
          handoffId: h.id,
          leadId: h.leadId,
          businessName: h.lead.businessName,
          customerId: null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const created = results.filter((r) => r.customerId).length;
    const failed = results.filter((r) => r.error).length;

    if (results.length > 0) {
      await writeAudit({
        actorUserId: user.id,
        entityType: "Customer",
        entityId: "bulk-backfill",
        action: "CREATE",
        after: {
          totalOrphans: results.length,
          created,
          failed,
          businessNames: results.map((r) => r.businessName),
        },
        ...getAuditContext(req),
      });
    }

    return NextResponse.json({
      totalOrphans: results.length,
      created,
      failed,
      results,
    });
  } catch (err) {
    return jsonError(err);
  }
}

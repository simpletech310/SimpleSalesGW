import { NextResponse } from "next/server";
import { HandoffStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { createCustomerFromHandoff } from "@/lib/customer/create-from-handoff";

/**
 * v2.15.2 — Per-handoff customer-recovery route.
 *
 * Backstop for the orphaned-accepted-handoff failure mode that bit T Sports:
 * the handoff was ACCEPTED but the Customer never got created (either
 * createCustomerFromHandoff threw partway, or the handoff was accepted before
 * v2.0-B shipped). The lead is stuck in CLOSED_WON with an accepted handoff
 * but the vCIO never sees the customer under /accounts.
 *
 * Idempotent: createCustomerFromHandoff returns the existing Customer if
 * one already exists, so calling this twice is safe.
 *
 * Gated by handoff:accept (COO + SUPERADMIN) — same gate as the original
 * accept route, because creating the customer is the second half of the
 * acceptance action.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "handoff:accept")) throw new ApiError(403, "Forbidden");
    const { id } = await params;

    const handoff = await prisma.handoff.findUnique({
      where: { id },
      include: { lead: { include: { customer: { select: { id: true } } } } },
    });
    if (!handoff) throw new ApiError(404, "Handoff not found");
    if (handoff.status !== HandoffStatus.ACCEPTED) {
      throw new ApiError(
        409,
        `Handoff is ${handoff.status.toLowerCase()} — only ACCEPTED handoffs can be recovered. ` +
        `Accept it normally via /api/handoffs/${id}/accept instead.`,
      );
    }
    if (handoff.lead.customer) {
      return NextResponse.json({
        ok: true,
        alreadyExisted: true,
        customerId: handoff.lead.customer.id,
        message: "Customer already exists for this lead.",
      });
    }

    const customer = await createCustomerFromHandoff({
      leadId: handoff.leadId,
      acceptedByUserId: handoff.acceptorUserId ?? user.id,
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "Customer",
      entityId: customer.id,
      action: "CREATE",
      after: {
        recoveredFromHandoffId: id,
        leadId: handoff.leadId,
        reason: "Orphaned accepted handoff — backfilled via /create-customer",
      },
      ...getAuditContext(req),
    });

    return NextResponse.json({ ok: true, alreadyExisted: false, customerId: customer.id });
  } catch (err) {
    return jsonError(err);
  }
}

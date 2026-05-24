import { NextResponse } from "next/server";
import { z } from "zod";
import { ActivityType, HandoffStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { createCustomerFromHandoff } from "@/lib/customer/create-from-handoff";

const schema = z.object({ note: z.string().max(2000).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "handoff:accept")) throw new ApiError(403, "Forbidden");
    const { id } = await params;
    const handoff = await prisma.handoff.findUnique({ where: { id } });
    if (!handoff) throw new ApiError(404, "Handoff not found");
    if (handoff.status !== HandoffStatus.INITIATED) {
      throw new ApiError(409, `Already ${handoff.status.toLowerCase()}`);
    }
    const body = schema.parse(await req.json().catch(() => ({})));

    // v2.15.2 — the prior implementation did three sequential awaits:
    //   1. flip handoff to ACCEPTED
    //   2. write Activity row
    //   3. createCustomerFromHandoff
    // If step 3 threw, the handoff was already ACCEPTED but no Customer
    // existed — exactly the T Sports orphan state.
    //
    // We still call createCustomerFromHandoff outside the transaction
    // because it internally opens its own $transaction (and Prisma doesn't
    // support nested transactions). But we run handoff.update first, then
    // try createCustomerFromHandoff inside a try/catch; if it fails, we
    // ROLL BACK the handoff to its prior state so the salesperson can
    // retry instead of being silently stuck.
    const updated = await prisma.handoff.update({
      where: { id },
      data: {
        status: HandoffStatus.ACCEPTED,
        acceptorUserId: user.id,
        acceptedAt: new Date(),
        notes: body.note ? `${handoff.notes ? handoff.notes + "\n\n" : ""}[Accepted] ${body.note}` : handoff.notes,
      },
    });
    await prisma.activity.create({
      data: {
        leadId: handoff.leadId,
        actorUserId: user.id,
        type: ActivityType.HANDOFF_ACCEPTED,
        subject: "Sales-to-Ops handoff accepted",
        body: body.note ?? null,
      },
    });

    // Spawn the post-close Customer record + onboarding tasks. If this
    // throws, undo the handoff status change so the COO can retry.
    let customer;
    try {
      customer = await createCustomerFromHandoff({
        leadId: handoff.leadId,
        acceptedByUserId: user.id,
      });
    } catch (createErr) {
      // eslint-disable-next-line no-console
      console.error("[handoff/accept] customer create failed — rolling back handoff status:", createErr);
      await prisma.handoff.update({
        where: { id },
        data: {
          status: handoff.status, // back to INITIATED
          acceptorUserId: handoff.acceptorUserId,
          acceptedAt: handoff.acceptedAt,
          notes: handoff.notes,
        },
      }).catch(() => undefined);
      throw new ApiError(
        500,
        "Handoff accepted but Customer creation failed. Status rolled back — please retry. " +
        (createErr instanceof Error ? createErr.message : ""),
      );
    }

    // v2.14 — notify the salesperson who initiated the handoff. Without
    // this, the SP has zero signal their handoff landed. We write a second
    // Activity row with actor = initiator so it lands in their /notifications
    // openActions queue, complete with a `nextAction` link to the new account.
    if (handoff.initiatorUserId && handoff.initiatorUserId !== user.id) {
      try {
        await prisma.activity.create({
          data: {
            leadId: handoff.leadId,
            actorUserId: handoff.initiatorUserId,
            type: ActivityType.HANDOFF_ACCEPTED,
            subject: "Your handoff was accepted",
            body: `Customer record created — open it under /accounts/${customer.id}`,
            nextAction: "Confirm the kickoff handshake with the vCIO",
            nextActionDueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days out
          },
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[handoff/accept] could not write initiator notification:", err);
      }
    }

    await writeAudit({
      actorUserId: user.id,
      entityType: "Handoff",
      entityId: id,
      action: "APPROVE",
      before: { status: handoff.status },
      after: {
        status: HandoffStatus.ACCEPTED,
        acceptorUserId: user.id,
        customerId: customer.id,
      },
      ...getAuditContext(req),
    });
    return NextResponse.json({ handoff: updated, customerId: customer.id });
  } catch (err) {
    return jsonError(err);
  }
}

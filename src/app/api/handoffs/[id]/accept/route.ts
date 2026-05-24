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

    // Spawn the post-close Customer record + onboarding tasks.
    const customer = await createCustomerFromHandoff({
      leadId: handoff.leadId,
      acceptedByUserId: user.id,
    });

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

import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  body: z.string().min(1).max(20_000),
  pinned: z.boolean().optional().default(false),
  clientId: z.string().min(8).max(64).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const data = schema.parse(await req.json());
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (lead.ownerUserId !== user.id && !can(user.role, "lead:edit:any") && !can(user.role, "lead:edit:scope-notes")) {
      throw new ApiError(403, "Forbidden");
    }

    // Idempotency: if clientId already exists on this lead, return the prior row.
    const clientId = data.clientId ?? req.headers.get("Idempotency-Key") ?? undefined;
    if (clientId) {
      const existing = await prisma.note.findUnique({
        where: { leadId_clientId: { leadId: id, clientId } },
      });
      if (existing) {
        return NextResponse.json({ note: existing, deduped: true });
      }
    }

    // v2.6 — vCIO notes are automatically tagged as scope notes (pinned + prefix)
    // so the rest of the team knows where the context came from.
    const isVcioScopeNote = user.role === Role.VCIO;
    const bodyToStore = isVcioScopeNote && !data.body.startsWith("[vCIO scope]")
      ? `[vCIO scope] ${data.body}`
      : data.body;
    const note = await prisma.note.create({
      data: {
        leadId: id,
        actorUserId: user.id,
        body: bodyToStore,
        pinned: data.pinned || isVcioScopeNote,
        clientId: clientId ?? null,
      },
    });
    await writeAudit({
      actorUserId: user.id,
      entityType: "Note",
      entityId: note.id,
      action: "CREATE",
      after: { leadId: id, pinned: data.pinned, viaOfflineQueue: !!clientId },
      ...getAuditContext(req),
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

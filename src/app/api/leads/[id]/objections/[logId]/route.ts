import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const patchSchema = z.object({
  rebuttalUsed: z.string().max(4000).optional().nullable(),
  outcome:      z.string().max(40).optional().nullable(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; logId: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id, logId } = await params;
    const lead = await prisma.lead.findUnique({ where: { id }, select: { ownerUserId: true } });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (lead.ownerUserId !== user.id && !can(user.role, "lead:edit:any")) {
      throw new ApiError(403, "Forbidden");
    }
    const existing = await prisma.objectionLog.findUnique({ where: { id: logId } });
    if (!existing || existing.leadId !== id) throw new ApiError(404, "Not found");
    const data = patchSchema.parse(await req.json());
    const updated = await prisma.objectionLog.update({
      where: { id: logId },
      data: {
        ...(data.rebuttalUsed !== undefined && { rebuttalUsed: data.rebuttalUsed }),
        ...(data.outcome !== undefined && { outcome: data.outcome }),
      },
    });
    await writeAudit({
      actorUserId: user.id,
      entityType: "ObjectionLog",
      entityId: logId,
      action: "UPDATE",
      before: { outcome: existing.outcome },
      after: { outcome: updated.outcome },
      ...getAuditContext(req),
    });
    return NextResponse.json({ log: updated });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; logId: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id, logId } = await params;
    const lead = await prisma.lead.findUnique({ where: { id }, select: { ownerUserId: true } });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (lead.ownerUserId !== user.id && !can(user.role, "lead:edit:any")) {
      throw new ApiError(403, "Forbidden");
    }
    const existing = await prisma.objectionLog.findUnique({ where: { id: logId } });
    if (!existing || existing.leadId !== id) throw new ApiError(404, "Not found");
    await prisma.objectionLog.delete({ where: { id: logId } });
    await writeAudit({
      actorUserId: user.id,
      entityType: "ObjectionLog",
      entityId: logId,
      action: "DELETE",
      before: { text: existing.text.slice(0, 200) },
      ...getAuditContext(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

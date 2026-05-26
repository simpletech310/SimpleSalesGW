import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { blobDel, isAttachmentCategory } from "@/lib/storage/blob";

/**
 * v3.3.13 — Patch category + caption on a lead attachment so SE/vCIO
 * can scan files at a glance.
 */
const PatchSchema = z.object({
  category: z.string().nullable().optional(),
  caption: z.string().max(500).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; attId: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id, attId } = await params;
    const att = await prisma.attachment.findUnique({ where: { id: attId } });
    if (!att || att.leadId !== id) throw new ApiError(404, "Attachment not found");
    const canEdit = att.uploadedByUserId === user.id || can(user.role, "lead:edit:any");
    if (!canEdit) throw new ApiError(403, "Forbidden");

    const body = PatchSchema.parse(await req.json());
    const category =
      body.category == null ? null : isAttachmentCategory(body.category) ? body.category : null;

    const updated = await prisma.attachment.update({
      where: { id: attId },
      data: {
        ...(body.category !== undefined ? { category } : {}),
        ...(body.caption !== undefined ? { caption: body.caption ?? null } : {}),
      },
    });
    await writeAudit({
      actorUserId: user.id,
      entityType: "Attachment",
      entityId: attId,
      action: "UPDATE",
      before: { category: att.category, caption: att.caption },
      after: { category: updated.category, caption: updated.caption },
      ...getAuditContext(req),
    });
    return NextResponse.json({ attachment: updated });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; attId: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id, attId } = await params;
    const att = await prisma.attachment.findUnique({ where: { id: attId } });
    if (!att || att.leadId !== id) throw new ApiError(404, "Attachment not found");
    const canDelete = att.uploadedByUserId === user.id || can(user.role, "lead:edit:any");
    if (!canDelete) throw new ApiError(403, "Forbidden");
    try {
      await blobDel(att.publicUrl);
    } catch (err) {
      // Continue — DB delete should still proceed even if blob is already gone.
      // eslint-disable-next-line no-console
      console.warn("[attachments] blob delete failed", err);
    }
    await prisma.attachment.delete({ where: { id: attId } });
    await writeAudit({
      actorUserId: user.id,
      entityType: "Attachment",
      entityId: attId,
      action: "DELETE",
      before: { leadId: id, filename: att.filename },
      ...getAuditContext(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { blobDel } from "@/lib/storage/blob";

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

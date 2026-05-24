import { NextResponse } from "next/server";
import { z } from "zod";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";

/**
 * v2.23 — GET / DELETE for polymorphic Attachment rows.
 *
 *   GET    /api/inventory-attachments?entityType=…&entityId=…
 *          returns [{ id, filename, contentType, byteSize, publicUrl, createdAt, uploadedBy }]
 *
 *   DELETE /api/inventory-attachments?id=…
 *          drops the row + best-effort deletes the Blob.
 */
export async function GET(req: Request) {
  try {
    await requireSessionUser();
    const url = new URL(req.url);
    const entityType = url.searchParams.get("entityType");
    const entityId = url.searchParams.get("entityId");
    if (!entityType || !entityId) {
      throw new ApiError(400, "entityType and entityId query params are required.");
    }
    const attachments = await prisma.attachment.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        filename: true,
        contentType: true,
        byteSize: true,
        publicUrl: true,
        createdAt: true,
        uploadedBy: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ attachments });
  } catch (err) {
    return jsonError(err);
  }
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function DELETE(req: Request) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "discovery:edit") && !can(user.role, "onboarding:manage")) {
      throw new ApiError(403, "Forbidden");
    }
    const url = new URL(req.url);
    const { id } = deleteSchema.parse({ id: url.searchParams.get("id") });

    const att = await prisma.attachment.findUnique({ where: { id } });
    if (!att) throw new ApiError(404, "Attachment not found");

    // Best-effort blob delete — if it fails (already deleted, etc.), still
    // drop the row so the UI doesn't leave a dangling pointer.
    try { await del(att.publicUrl); } catch { /* ignore */ }

    await prisma.attachment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

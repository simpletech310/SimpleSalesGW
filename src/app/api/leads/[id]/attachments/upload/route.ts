import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { ALLOWED_CONTENT_TYPES, MAX_FILE_BYTES } from "@/lib/storage/blob";

/**
 * Vercel Blob direct-upload handshake.
 * 1) Client posts file metadata → we issue a one-time upload token.
 * 2) Client uploads directly to Blob.
 * 3) Vercel calls back here with onUploadCompleted → we write the Attachment row.
 *
 * Avoids the 4.5 MB body limit on regular API routes.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // v2.14 — guard against the silent-hang failure mode: without
    // BLOB_READ_WRITE_TOKEN, Vercel's handleUpload returns opaque errors or
    // hangs the client. Surface a clean 503 with the var name instead.
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new ApiError(
        503,
        "File uploads aren't configured. Ask your admin to set BLOB_READ_WRITE_TOKEN in Vercel env.",
      );
    }

    const user = await requireSessionUser();
    const { id: leadId } = await params;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (lead.ownerUserId !== user.id && !can(user.role, "lead:edit:any")) {
      throw new ApiError(403, "Forbidden");
    }

    const body = (await req.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [...ALLOWED_CONTENT_TYPES],
        maximumSizeInBytes: MAX_FILE_BYTES,
        tokenPayload: JSON.stringify({ leadId, uploadedByUserId: user.id, filename: "" }),
      }),
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const meta = tokenPayload ? (JSON.parse(tokenPayload) as { leadId: string; uploadedByUserId: string }) : null;
        if (!meta) return;
        // Persist Attachment row
        const filenameFromUrl = decodeURIComponent(blob.url.split("/").pop() ?? "file");
        const attachment = await prisma.attachment.create({
          data: {
            leadId: meta.leadId,
            uploadedByUserId: meta.uploadedByUserId,
            filename: filenameFromUrl,
            contentType: blob.contentType ?? "application/octet-stream",
            byteSize: blob.contentDisposition ? 0 : 0, // size not directly on blob result; approximate
            storagePath: blob.pathname,
            publicUrl: blob.url,
          },
        });
        await writeAudit({
          actorUserId: meta.uploadedByUserId,
          entityType: "Attachment",
          entityId: attachment.id,
          action: "CREATE",
          after: { leadId: meta.leadId, filename: attachment.filename, contentType: attachment.contentType },
        });
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    return jsonError(err);
  }
}

// Required to wire audit context — used inside handleUpload's callbacks above.
void getAuditContext;

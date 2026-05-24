import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { prisma } from "@/lib/prisma";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { ALLOWED_CONTENT_TYPES, MAX_FILE_BYTES } from "@/lib/storage/blob";

/**
 * v2.23 — Polymorphic Attachment upload for inventory items + customer
 * + assessment context. Mirrors the v1.1-F lead upload handshake but
 * persists Attachment rows with (entityType, entityId) instead of leadId.
 *
 * Body must carry `?entityType=…&entityId=…` query params on the POST
 * that initiates the Vercel Blob token handshake. The token payload
 * carries them through to the upload-complete callback.
 *
 * RBAC: anyone who can edit the underlying customer (discovery:edit OR
 * onboarding:manage) can attach. We keep the gate broad because the
 * vCIO might attach photos while a manager runs the survey.
 */

const ALLOWED_ENTITY_TYPES = new Set([
  "FirewallAsset",
  "SwitchAsset",
  "AccessPoint",
  "ServerAsset",
  "StorageAsset",
  "NetworkCircuit",
  "EndpointSummary",
  "LicenseEntry",
  "VendorContract",
  "Site",
  "Customer",
  "DiscoveryAssessment",
]);

export async function POST(req: Request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new ApiError(
        503,
        "File uploads aren't configured. Ask your admin to set BLOB_READ_WRITE_TOKEN in Vercel env.",
      );
    }

    const user = await requireSessionUser();
    if (!can(user.role, "discovery:edit") && !can(user.role, "onboarding:manage")) {
      throw new ApiError(403, "Forbidden");
    }

    const url = new URL(req.url);
    const entityType = url.searchParams.get("entityType");
    const entityId = url.searchParams.get("entityId");

    if (!entityType || !entityId) {
      throw new ApiError(400, "entityType and entityId query params are required.");
    }
    if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
      throw new ApiError(400, `entityType "${entityType}" is not allowed.`);
    }

    const body = (await req.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        // Allow images + video in addition to the standard set
        allowedContentTypes: [
          ...ALLOWED_CONTENT_TYPES,
          "video/mp4",
          "video/quicktime",
          "video/webm",
        ],
        maximumSizeInBytes: MAX_FILE_BYTES,
        tokenPayload: JSON.stringify({
          entityType,
          entityId,
          uploadedByUserId: user.id,
        }),
      }),
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const meta = tokenPayload
          ? (JSON.parse(tokenPayload) as { entityType: string; entityId: string; uploadedByUserId: string })
          : null;
        if (!meta) return;
        const filenameFromUrl = decodeURIComponent(blob.url.split("/").pop() ?? "file");
        const attachment = await prisma.attachment.create({
          data: {
            entityType: meta.entityType,
            entityId: meta.entityId,
            uploadedByUserId: meta.uploadedByUserId,
            filename: filenameFromUrl,
            contentType: blob.contentType ?? "application/octet-stream",
            byteSize: 0,
            storagePath: blob.pathname,
            publicUrl: blob.url,
          },
        });
        await writeAudit({
          actorUserId: meta.uploadedByUserId,
          entityType: "Attachment",
          entityId: attachment.id,
          action: "CREATE",
          after: {
            entityType: meta.entityType,
            entityId: meta.entityId,
            filename: attachment.filename,
            contentType: attachment.contentType,
          },
        });
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    return jsonError(err);
  }
}

import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { prisma } from "@/lib/prisma";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { ALLOWED_CONTENT_TYPES, MAX_FILE_BYTES } from "@/lib/storage/blob";

/**
 * Vercel Blob direct-upload handshake for Signed Documents.
 *
 * Unlike the attachment upload route, this one does NOT create a DB row in
 * onUploadCompleted — the SignedDocument record is created by the form POST
 * to /api/{leads|accounts}/[id]/documents once the user fills in the
 * metadata. The blob URL is returned to the browser to pre-fill the form.
 *
 * Caller must pass `clientPayload` as `{"scope":"lead"|"customer","parentId":"<uuid>"}`
 * so we can RBAC-check before issuing the upload token.
 */
export async function POST(req: Request) {
  try {
    // v2.14 — surface unconfigured blob storage as a clean 503 instead of
    // hanging the upload client.
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new ApiError(
        503,
        "Document uploads aren't configured. Ask your admin to set BLOB_READ_WRITE_TOKEN in Vercel env.",
      );
    }

    const user = await requireSessionUser();
    const body = (await req.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayloadStr) => {
        let scope: "lead" | "customer" = "lead";
        let parentId = "";
        if (clientPayloadStr) {
          try {
            const parsed = JSON.parse(clientPayloadStr) as { scope?: string; parentId?: string };
            if (parsed.scope === "lead" || parsed.scope === "customer") scope = parsed.scope;
            if (typeof parsed.parentId === "string") parentId = parsed.parentId;
          } catch { /* ignore */ }
        }
        if (!parentId) throw new ApiError(400, "parentId required");

        // RBAC: same as creating a SignedDocument row.
        if (!can(user.role, "lead:create") && !can(user.role, "lead:edit:any")) {
          throw new ApiError(403, "Forbidden");
        }

        if (scope === "lead") {
          const lead = await prisma.lead.findUnique({ where: { id: parentId }, select: { ownerUserId: true } });
          if (!lead) throw new ApiError(404, "Lead not found");
          if (lead.ownerUserId !== user.id && !can(user.role, "lead:edit:any")) {
            throw new ApiError(403, "Forbidden");
          }
        } else {
          const customer = await prisma.customer.findUnique({
            where: { id: parentId },
            select: { lead: { select: { ownerUserId: true } } },
          });
          if (!customer) throw new ApiError(404, "Customer not found");
          if (!can(user.role, "onboarding:manage") && customer.lead.ownerUserId !== user.id) {
            throw new ApiError(403, "Forbidden");
          }
        }

        return {
          allowedContentTypes: [...ALLOWED_CONTENT_TYPES],
          maximumSizeInBytes: MAX_FILE_BYTES,
          tokenPayload: JSON.stringify({ scope, parentId, uploadedByUserId: user.id }),
        };
      },
      onUploadCompleted: async () => {
        // No-op: the SignedDocument row is created by the form POST. The blob
        // URL is returned to the client via the upload() helper's resolved value.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    return jsonError(err);
  }
}

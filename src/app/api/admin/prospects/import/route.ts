import { NextResponse } from "next/server";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { importBurbankProspects } from "@/lib/prospects/import";

/**
 * v2.14 — Imports the Burbank shortlist. RBAC: same as catalog edit
 * (`pricing:catalog:edit` is granted to SUPERADMIN + SALES_MANAGER). We
 * piggy-back instead of inventing a new permission because the same
 * "ops people who manage the live tool" cohort runs this.
 *
 * POST /api/admin/prospects/import
 *   body: {} | { ownerEmail?: string }
 *   returns: { total, created, skipped, createdNames, skippedNames, ownerEmail }
 */
export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "pricing:catalog:edit")) {
      throw new ApiError(403, "Forbidden");
    }

    const body = await req.json().catch(() => ({}));
    const ownerEmail = typeof body?.ownerEmail === "string" ? body.ownerEmail : undefined;

    const result = await importBurbankProspects({ ownerEmail });

    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: "bulk-import",
      action: "CREATE",
      after: {
        total: result.total,
        created: result.created,
        skipped: result.skipped,
        ownerEmail: result.ownerEmail,
      },
      ...getAuditContext(req),
    });

    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { enrichLead } from "@/lib/lead-enrich/enrich";

/**
 * v3.3.9 — POST /api/leads/enrich
 *
 * Takes a partial lead form payload and returns an EnrichmentResult
 * (per-field proposals with confidence + source). UI surfaces it as a
 * preview the rep can accept-all or per-field before submitting the
 * actual /api/leads create call.
 *
 * Read-only — does NOT create a Lead row. Auth: lead:create.
 */
const Schema = z.object({
  businessName: z.string().min(2).max(200),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  addressStreet: z.string().max(200).optional(),
  addressCity: z.string().max(100).optional(),
  addressState: z.string().max(50).optional(),
  addressZip: z.string().max(20).optional(),
  primaryContactName: z.string().max(200).optional(),
  primaryContactEmail: z.string().email().optional().or(z.literal("")),
  primaryContactPhone: z.string().max(50).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "lead:create") && !can(user.role, "lead:edit:any")) {
      throw new ApiError(403, "Forbidden");
    }
    const json = await req.json();
    const seed = Schema.parse(json);

    const result = await enrichLead(
      {
        ...seed,
        websiteUrl: seed.websiteUrl || null,
        primaryContactEmail: seed.primaryContactEmail || null,
      },
      { userId: user.id },
    );

    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}

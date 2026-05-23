import { NextResponse } from "next/server";
import { Industry, OutreachCategory } from "@prisma/client";
import { jsonError, requireSessionUser } from "@/lib/api";
import { loadOutreachTemplates } from "@/lib/outreach/templates";

/**
 * Filterable list of outreach templates. Any authenticated user can read.
 * Query params:
 *   - industry  : Industry enum value (matches industry-specific + null/global)
 *   - trigger   : string (matches trigger + null/global)
 *   - category  : OutreachCategory enum value
 */
export async function GET(req: Request) {
  try {
    await requireSessionUser();
    const url = new URL(req.url);
    const industryRaw = url.searchParams.get("industry");
    const triggerRaw = url.searchParams.get("trigger");
    const categoryRaw = url.searchParams.get("category");

    const industry =
      industryRaw && (Object.values(Industry) as string[]).includes(industryRaw)
        ? (industryRaw as Industry)
        : undefined;
    const category =
      categoryRaw && (Object.values(OutreachCategory) as string[]).includes(categoryRaw)
        ? (categoryRaw as OutreachCategory)
        : undefined;

    const templates = await loadOutreachTemplates({
      industry,
      trigger: triggerRaw ?? undefined,
      category,
    });
    return NextResponse.json({ templates });
  } catch (err) {
    return jsonError(err);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { DealKind, Industry, LeadSource, MspSatisfaction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { parseCsv, normalizeHeader } from "@/lib/csv-parse";

/**
 * v3.3.9 — Bulk lead import.
 *
 * Two modes via query / body flag:
 *   - mode=preview (default): parse + validate the CSV, return rows + errors
 *     without writing anything
 *   - mode=create: actually insert the rows; skips duplicates by businessName
 *
 * Body shape:
 *   { csv: "header,header\nval,val", mode?: "preview"|"create", ownerEmail?: string }
 *
 * Permissions:
 *   - lead:create → can import to their own ownership
 *   - lead:assign or sales-rep:create → can pass ownerEmail to assign to others
 */

const Body = z.object({
  csv: z.string().min(2),
  mode: z.enum(["preview", "create"]).default("preview"),
  ownerEmail: z.string().email().optional(),
});

type RowResult = {
  rowIndex: number;
  // The raw input cells (for the preview table)
  raw: Record<string, string>;
  // Normalized + validated lead data (when valid)
  normalized?: Record<string, unknown>;
  errors: string[];
  warnings: string[];
  // After create mode runs
  status?: "created" | "skipped_duplicate" | "error";
  leadId?: string;
};

function pickIndustry(raw: string | undefined): Industry | null {
  if (!raw) return null;
  const upper = raw.toUpperCase().replace(/[^A-Z]/g, "_");
  if ((Object.values(Industry) as string[]).includes(upper)) return upper as Industry;
  // Fuzzy mapping
  const lower = raw.toLowerCase();
  if (/med|health|clinic|dent|hospital/.test(lower)) return Industry.MEDICAL;
  if (/legal|law|attorney/.test(lower)) return Industry.LEGAL;
  if (/federal|gov|defense/.test(lower)) return Industry.FEDERAL_CONTRACTING;
  if (/manufact|industrial|machining/.test(lower)) return Industry.MANUFACTURING;
  if (/hotel|hospitality|restaurant|food/.test(lower)) return Industry.HOSPITALITY;
  if (/financ|bank|insur|invest/.test(lower)) return Industry.FINANCIAL_SERVICES;
  if (/account|consult|profession|service/.test(lower)) return Industry.PROFESSIONAL_SERVICES;
  if (/school|educat|univer|college/.test(lower)) return Industry.EDUCATION;
  if (/nonprofit|charity|ngo|church/.test(lower)) return Industry.NONPROFIT;
  return null;
}

function pickSource(raw: string | undefined): LeadSource {
  if (!raw) return LeadSource.INBOUND;
  const upper = raw.toUpperCase().replace(/[^A-Z]/g, "_");
  if ((Object.values(LeadSource) as string[]).includes(upper)) return upper as LeadSource;
  return LeadSource.INBOUND;
}

function pickDealKind(raw: string | undefined): DealKind {
  if (!raw) return DealKind.MANAGED_IT_BUNDLE;
  const upper = raw.toUpperCase().replace(/[^A-Z]/g, "_");
  if ((Object.values(DealKind) as string[]).includes(upper)) return upper as DealKind;
  return DealKind.MANAGED_IT_BUNDLE;
}

function normalizeRow(raw: Record<string, string>): {
  data?: Record<string, unknown>;
  errors: string[];
  warnings: string[];
} {
  // Translate sloppy headers → canonical keys
  const r: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const canon = normalizeHeader(k);
    if (canon) r[canon] = v;
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  const businessName = (r.businessName ?? "").trim();
  if (!businessName) errors.push("businessName is required");

  const industry = pickIndustry(r.industry);
  if (!industry && r.industry) {
    warnings.push(`industry "${r.industry}" not recognized — defaulting to OTHER`);
  }

  const seatCount = r.seatCount ? Number(r.seatCount.replace(/[^0-9.-]/g, "")) : undefined;
  if (seatCount != null && (!Number.isFinite(seatCount) || seatCount < 0)) {
    warnings.push(`seatCount "${r.seatCount}" is not a valid number — dropping`);
  }
  const siteCount = r.siteCount ? Number(r.siteCount.replace(/[^0-9.-]/g, "")) : undefined;

  function strField(k: string, max: number): string | undefined {
    const v = r[k]?.trim();
    if (!v) return undefined;
    if (v.length > max) {
      warnings.push(`${k} truncated to ${max} chars`);
      return v.slice(0, max);
    }
    return v;
  }

  function urlOrEmpty(v: string | undefined): string | undefined {
    if (!v) return undefined;
    let candidate = v.trim();
    if (!/^https?:\/\//i.test(candidate)) candidate = "https://" + candidate;
    try {
      new URL(candidate);
      return candidate;
    } catch {
      warnings.push(`url "${v}" is not parseable — dropping`);
      return undefined;
    }
  }

  if (errors.length > 0) return { errors, warnings };

  const data: Record<string, unknown> = {
    businessName,
    dbaName: strField("dbaName", 200),
    industry: industry ?? Industry.OTHER,
    subindustry: strField("subindustry", 200),
    seatCount: Number.isFinite(seatCount) && seatCount! >= 0 ? Math.round(seatCount as number) : undefined,
    siteCount: Number.isFinite(siteCount) && siteCount! > 0 ? Math.round(siteCount as number) : 1,
    addressStreet: strField("addressStreet", 200),
    addressCity: strField("addressCity", 100),
    addressState: strField("addressState", 50),
    addressZip: strField("addressZip", 20),
    websiteUrl: urlOrEmpty(r.websiteUrl),
    linkedinCompanyUrl: urlOrEmpty(r.linkedinCompanyUrl),
    googleBusinessUrl: urlOrEmpty(r.googleBusinessUrl),
    primaryContactName: strField("primaryContactName", 200),
    primaryContactTitle: strField("primaryContactTitle", 200),
    primaryContactEmail: r.primaryContactEmail
      ? /.+@.+\..+/.test(r.primaryContactEmail.trim())
        ? r.primaryContactEmail.trim()
        : (warnings.push(`primaryContactEmail "${r.primaryContactEmail}" looks malformed — dropping`), undefined)
      : undefined,
    primaryContactPhone: strField("primaryContactPhone", 50),
    executiveSponsorName: strField("executiveSponsorName", 200),
    executiveSponsorTitle: strField("executiveSponsorTitle", 200),
    currentMspName: strField("currentMspName", 200),
    currentMspSatisfaction: MspSatisfaction.NONE,
    source: pickSource(r.source),
    dealKind: pickDealKind(r.dealKind),
    notes: strField("notes", 5000),
  };

  return { data, errors, warnings };
}

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "lead:create")) throw new ApiError(403, "Forbidden");
    const body = Body.parse(await req.json());

    // Resolve owner — defaults to the caller; only managers can assign elsewhere.
    let ownerId = user.id;
    if (body.ownerEmail && body.ownerEmail !== "") {
      if (!can(user.role, "lead:assign") && !can(user.role, "sales-rep:create")) {
        throw new ApiError(403, "Only managers can assign imports to another rep.");
      }
      const owner = await prisma.user.findUnique({
        where: { email: body.ownerEmail },
        select: { id: true },
      });
      if (!owner) throw new ApiError(400, `Owner email "${body.ownerEmail}" not found.`);
      ownerId = owner.id;
    }

    const parsed = parseCsv(body.csv);
    if (parsed.rows.length === 0) {
      throw new ApiError(400, "CSV had no data rows. Make sure the first row is headers.");
    }
    if (parsed.rows.length > 500) {
      throw new ApiError(400, `Too many rows (${parsed.rows.length}). Max is 500 per import — split the file.`);
    }

    const results: RowResult[] = parsed.rows.map((raw, i) => {
      const { data, errors, warnings } = normalizeRow(raw);
      return {
        rowIndex: i + 2, // header is row 1, first data row is row 2
        raw,
        normalized: data,
        errors,
        warnings,
      };
    });

    const validCount = results.filter((r) => r.errors.length === 0).length;
    const errorCount = results.length - validCount;

    if (body.mode === "preview") {
      return NextResponse.json({
        mode: "preview",
        total: results.length,
        valid: validCount,
        invalid: errorCount,
        headers: parsed.headers,
        results,
      });
    }

    // CREATE mode — skip rows with errors, skip duplicates by exact businessName.
    let created = 0;
    let skippedDup = 0;
    let skippedError = 0;
    for (const r of results) {
      if (r.errors.length > 0 || !r.normalized) {
        r.status = "error";
        skippedError++;
        continue;
      }
      const businessName = String(r.normalized.businessName);
      const existing = await prisma.lead.findFirst({
        where: { businessName },
        select: { id: true },
      });
      if (existing) {
        r.status = "skipped_duplicate";
        r.leadId = existing.id;
        skippedDup++;
        continue;
      }
      try {
        const lead = await prisma.lead.create({
          data: {
            ...(r.normalized as Record<string, unknown>),
            ownerUserId: ownerId,
          } as never,
        });
        r.status = "created";
        r.leadId = lead.id;
        created++;
      } catch (e) {
        r.status = "error";
        r.errors.push(`Create failed: ${(e as Error).message}`);
        skippedError++;
      }
    }

    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: "bulk-import",
      action: "CREATE",
      after: {
        bulkImport: true,
        total: results.length,
        created,
        skippedDup,
        skippedError,
        ownerEmail: body.ownerEmail ?? null,
      },
      ...getAuditContext(req),
    });

    return NextResponse.json({
      mode: "create",
      total: results.length,
      created,
      skippedDuplicate: skippedDup,
      errors: skippedError,
      ownerUserId: ownerId,
      results,
    });
  } catch (err) {
    return jsonError(err);
  }
}

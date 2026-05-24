import { prisma } from "@/lib/prisma";
import { BURBANK_PROSPECTS, PROSPECT_IMPORT_DEFAULTS } from "./burbank-shortlist";

export type ImportResult = {
  total: number;
  created: number;
  skipped: number;
  createdNames: string[];
  skippedNames: string[];
  ownerEmail: string;
};

/**
 * v2.14 — Idempotent bulk seed of the Burbank shortlist into the Lead table.
 *
 * Skips any row whose `businessName` already exists (case-sensitive). Each
 * row is assigned to `ownerEmail` (defaults to lin@gatewaytelnet.com — the
 * seeded salesperson). If that user doesn't exist (e.g. ops nuked the seed
 * users), throws a clear error rather than silently picking another user.
 *
 * Returns the counts + names so the API route can render a result toast.
 */
export async function importBurbankProspects(opts?: {
  ownerEmail?: string;
}): Promise<ImportResult> {
  const ownerEmail = opts?.ownerEmail ?? "lin@gatewaytelnet.com";
  const owner = await prisma.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true, email: true },
  });
  if (!owner) {
    throw new Error(
      `Owner user "${ownerEmail}" not found. Ensure the seed has run or pass an existing user's email.`,
    );
  }

  const result: ImportResult = {
    total: BURBANK_PROSPECTS.length,
    created: 0,
    skipped: 0,
    createdNames: [],
    skippedNames: [],
    ownerEmail: owner.email,
  };

  for (const p of BURBANK_PROSPECTS) {
    const existing = await prisma.lead.findFirst({
      where: { businessName: p.businessName },
      select: { id: true },
    });
    if (existing) {
      result.skipped += 1;
      result.skippedNames.push(p.businessName);
      continue;
    }
    await prisma.lead.create({
      data: {
        ownerUserId: owner.id,
        businessName: p.businessName,
        industry: p.industry,
        seatCount: p.seatCount,
        siteCount: p.siteCount,
        addressCity: p.addressCity,
        addressState: p.addressState,
        websiteUrl: p.websiteUrl,
        complianceDrivers: p.complianceDrivers,
        currentMspSatisfaction: p.currentMspSatisfaction,
        researchSummary: p.researchSummary,
        primaryContactTitle: p.primaryContactTitle,
        pipelineStage: PROSPECT_IMPORT_DEFAULTS.pipelineStage,
        source: PROSPECT_IMPORT_DEFAULTS.source,
      },
    });
    result.created += 1;
    result.createdNames.push(p.businessName);
  }

  return result;
}

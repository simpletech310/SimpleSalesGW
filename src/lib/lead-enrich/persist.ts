/**
 * v3.3.28 — Non-null overwrite merger for agent briefings.
 *
 * The agentic research loop returns a briefing JSON that may have any
 * subset of fields populated. We persist ONLY what the agent actually
 * found — null scalars and empty arrays are skipped so a research pass
 * that comes up empty never clobbers a value the rep had typed in by
 * hand.
 *
 * Also handles the three "card" arrays (researchFitSignals,
 * researchSuggestedQuestions, researchRisks) and the prose summary so
 * the gather route uses one single persistence path.
 *
 * Returns the actual diff applied (useful for telemetry + tests).
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { AgentBriefing } from "@/lib/lead-enrich/agent";

export type ApplyEnrichmentOptions = {
  /** Where the data came from. Stored on Lead.enrichmentSource for telemetry. */
  source?: string;
  /** When true (default), updates researchCompletedAt + enrichmentCompletedAt. */
  bumpTimestamps?: boolean;
};

export type EnrichmentDiff = {
  updatedFields: string[];
  skippedFields: string[];
};

/** Result a caller can inspect to see what landed on the DB. */
export type ApplyEnrichmentResult = {
  ok: boolean;
  diff: EnrichmentDiff;
};

/**
 * Merge the briefing into the Lead row. Caller is responsible for
 * including the prose summary + the three card arrays in the briefing's
 * top-level fields (already shaped that way by the agent prompt).
 *
 * Field skip rules:
 *   - null/undefined → skip
 *   - empty string ""  → skip
 *   - empty array []   → skip (preserves any existing values)
 *   - non-null scalar  → overwrite
 *   - non-empty array  → REPLACE (the agent ran in-context, so it
 *                        produced the authoritative current view; we
 *                        don't try to dedupe-merge with existing entries)
 */
export async function applyEnrichmentToLead(
  leadId: string,
  briefing: AgentBriefing,
  opts: ApplyEnrichmentOptions = {},
): Promise<ApplyEnrichmentResult> {
  const { data, diff } = buildEnrichmentUpdate(briefing, opts);

  if (Object.keys(data).length === 0) {
    return { ok: true, diff };
  }

  try {
    await prisma.lead.update({ where: { id: leadId }, data });
    return { ok: true, diff };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[lead-enrich/persist] update failed:", (err as Error).message);
    return { ok: false, diff };
  }
}

/**
 * Pure build-only counterpart to applyEnrichmentToLead — produces the
 * Prisma update object + diff without touching the DB. Exported for
 * unit tests; the merge semantics are the contract we care about.
 */
export function buildEnrichmentUpdate(
  briefing: AgentBriefing,
  opts: ApplyEnrichmentOptions = {},
): { data: Prisma.LeadUpdateInput; diff: EnrichmentDiff } {
  const data: Prisma.LeadUpdateInput = {};
  const diff: EnrichmentDiff = { updatedFields: [], skippedFields: [] };

  // --- The three persisted "card" arrays + prose summary (legacy shape) ---
  setStr(data, diff, "researchSummary", briefing.summary);
  setStrArr(data, diff, "researchFitSignals", briefing.fitSignals);
  setStrArr(data, diff, "researchSuggestedQuestions", briefing.suggestedQuestions);
  setStrArr(data, diff, "researchRisks", briefing.risks);

  // --- Business profile facts ---
  const bp = briefing.businessProfile;
  if (bp) {
    setInt(data, diff, "foundedYear", bp.foundedYear);
    setStr(data, diff, "estimatedAnnualRevenue", bp.estimatedAnnualRevenue);
    setStr(data, diff, "employeeCountBand", bp.employeeCountBand);
    setStr(data, diff, "registeredEntityType", bp.registeredEntityType);
    if (bp.charterIdentifiers && Object.values(bp.charterIdentifiers).some(isNonEmpty)) {
      data.charterIdentifiers = bp.charterIdentifiers as unknown as Prisma.InputJsonValue;
      diff.updatedFields.push("charterIdentifiers");
    } else {
      diff.skippedFields.push("charterIdentifiers");
    }
  }

  // --- Offices ---
  if (Array.isArray(briefing.offices)) {
    const cleaned = briefing.offices.filter(
      (o) => o && (isNonEmpty(o.address) || isNonEmpty(o.city) || isNonEmpty(o.label)),
    );
    if (cleaned.length > 0) {
      data.offices = cleaned as unknown as Prisma.InputJsonValue;
      diff.updatedFields.push("offices");
    } else {
      diff.skippedFields.push("offices");
    }
  }

  // --- Key contacts ---
  if (Array.isArray(briefing.keyContacts)) {
    const cleaned = briefing.keyContacts.filter((k) => k && isNonEmpty(k.name));
    if (cleaned.length > 0) {
      data.keyContacts = cleaned as unknown as Prisma.InputJsonValue;
      diff.updatedFields.push("keyContacts");
    } else {
      diff.skippedFields.push("keyContacts");
    }
  }

  // --- Tech footprint ---
  const tf = briefing.techFootprint;
  if (tf) {
    setStrArr(data, diff, "techStackHints", tf.techStackHints);
    setStr(data, diff, "emailProvider", tf.emailProvider);
    setStr(data, diff, "websiteCms", tf.websiteCms);
    setStrArr(data, diff, "publicCertifications", tf.publicCertifications);
  }

  // --- Recent news ---
  if (Array.isArray(briefing.recentNews)) {
    const cleaned = briefing.recentNews.filter(
      (n) => n && isNonEmpty(n.url) && isNonEmpty(n.title),
    );
    if (cleaned.length > 0) {
      data.recentNews = cleaned as unknown as Prisma.InputJsonValue;
      diff.updatedFields.push("recentNews");
    } else {
      diff.skippedFields.push("recentNews");
    }
  }

  // --- Social URLs ---
  const su = briefing.socialUrls;
  if (su) {
    setStr(data, diff, "socialFacebookUrl", su.facebook);
    setStr(data, diff, "socialTwitterUrl", su.twitter);
    setStr(data, diff, "socialYoutubeUrl", su.youtube);
  }

  // --- Press contact ---
  setStr(data, diff, "pressContactEmail", briefing.pressContactEmail);

  // --- Audit timestamps + source label ---
  if (opts.bumpTimestamps !== false) {
    const now = new Date();
    data.researchCompletedAt = now;
    data.enrichmentCompletedAt = now;
  }
  if (opts.source) {
    data.enrichmentSource = opts.source;
  }

  return { data, diff };
}

// ---------------------------------------------------------------------------
// Tiny merge helpers — exported for unit tests
// ---------------------------------------------------------------------------

export function isNonEmpty(v: unknown): v is NonNullable<typeof v> {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

function setStr(
  data: Prisma.LeadUpdateInput,
  diff: EnrichmentDiff,
  key: keyof Prisma.LeadUpdateInput,
  value: string | null | undefined,
): void {
  if (typeof value === "string" && value.trim().length > 0) {
    (data as Record<string, unknown>)[key as string] = value.trim();
    diff.updatedFields.push(key as string);
  } else {
    diff.skippedFields.push(key as string);
  }
}

function setInt(
  data: Prisma.LeadUpdateInput,
  diff: EnrichmentDiff,
  key: keyof Prisma.LeadUpdateInput,
  value: number | null | undefined,
): void {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    (data as Record<string, unknown>)[key as string] = Math.round(value);
    diff.updatedFields.push(key as string);
  } else {
    diff.skippedFields.push(key as string);
  }
}

function setStrArr(
  data: Prisma.LeadUpdateInput,
  diff: EnrichmentDiff,
  key: keyof Prisma.LeadUpdateInput,
  value: string[] | null | undefined,
): void {
  if (Array.isArray(value)) {
    const cleaned = value
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim());
    if (cleaned.length > 0) {
      (data as Record<string, unknown>)[key as string] = cleaned;
      diff.updatedFields.push(key as string);
      return;
    }
  }
  diff.skippedFields.push(key as string);
}

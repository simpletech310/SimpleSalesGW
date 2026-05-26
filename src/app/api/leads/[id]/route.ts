import { NextResponse } from "next/server";
import { z } from "zod";
import { DealKind, Industry, LeadSource, MspSatisfaction, PipelineStage, ServiceLine } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can, leadIsVisible } from "@/lib/rbac";
import { writeAudit, diffForAudit } from "@/lib/audit";
import { autoScoreQualification } from "@/lib/qualification/auto-score";
import { verdictFor } from "@/lib/qualification";

/**
 * v2.14 — fields that, when mutated on a Lead, should re-run the
 * qualification auto-score so the QualificationScorecard never goes stale
 * silently. Gate transitions (LEAD → QUALIFIED) use these numbers, so a
 * stale scorecard means a wrong gate.
 */
const SCORING_FIELDS = new Set<string>([
  "industry",
  "seatCount",
  "siteCount",
  "addressCity",
  "addressState",
  "executiveSponsorName",
  "currentMspSatisfaction",
  "cyberInsuranceRenewalDate",
  "complianceDrivers",
]);

const updateSchema = z.object({
  businessName: z.string().min(1).max(200).optional(),
  dbaName: z.string().max(200).nullable().optional(),
  industry: z.nativeEnum(Industry).optional(),
  subindustry: z.string().max(200).nullable().optional(),
  seatCount: z.coerce.number().int().nonnegative().nullable().optional(),
  siteCount: z.coerce.number().int().positive().optional(),
  addressStreet: z.string().max(200).nullable().optional(),
  addressCity: z.string().max(100).nullable().optional(),
  addressState: z.string().max(50).nullable().optional(),
  addressZip: z.string().max(20).nullable().optional(),
  websiteUrl: z.string().url().nullable().optional().or(z.literal("")),
  linkedinCompanyUrl: z.string().url().nullable().optional().or(z.literal("")),
  googleBusinessUrl: z.string().url().nullable().optional().or(z.literal("")),
  currentMspName: z.string().max(200).nullable().optional(),
  currentMspSatisfaction: z.nativeEnum(MspSatisfaction).optional(),
  primaryContactName: z.string().max(200).nullable().optional(),
  primaryContactTitle: z.string().max(200).nullable().optional(),
  primaryContactEmail: z.string().email().nullable().optional().or(z.literal("")),
  primaryContactPhone: z.string().max(50).nullable().optional(),
  executiveSponsorName: z.string().max(200).nullable().optional(),
  executiveSponsorTitle: z.string().max(200).nullable().optional(),
  source: z.nativeEnum(LeadSource).optional(),
  pipelineStage: z.nativeEnum(PipelineStage).optional(),
  // v2.15 — sales can change the deal kind mid-deal (e.g. customer added cameras to a voice-only quote)
  dealKind: z.nativeEnum(DealKind).optional(),
  dealLineItems: z.unknown().optional(), // Json — validated by PricingCard payload
  researchSummary: z.string().max(20_000).nullable().optional(),
  // v3.3.10 — research-tab cards now first-class on the lead. Rep can curate
  // the auto-generated lists; truncate any single bullet to 500 chars.
  researchFitSignals: z.array(z.string().max(500)).max(20).optional(),
  researchSuggestedQuestions: z.array(z.string().max(500)).max(20).optional(),
  researchRisks: z.array(z.string().max(500)).max(20).optional(),
  // v3.3.11 — multi-service intake mirrors POST /api/leads schema
  interestedServices: z.array(z.nativeEnum(ServiceLine)).max(15).optional(),
  currentPhoneSystem: z.string().max(200).nullable().optional(),
  currentPhonePainPoint: z.string().max(2000).nullable().optional(),
  currentAccessControl: z.string().max(200).nullable().optional(),
  currentAccessDoorCount: z.coerce.number().int().nonnegative().nullable().optional(),
  currentVideoSurveillance: z.string().max(200).nullable().optional(),
  currentVideoCameraCount: z.coerce.number().int().nonnegative().nullable().optional(),
  cablingStatus: z.string().max(200).nullable().optional(),
  expansionPlans: z.string().max(2000).nullable().optional(),
  aiAdvisoryInterest: z.string().max(2000).nullable().optional(),
  expectedCloseDate: z.string().datetime().nullable().optional(),
  closedLostReason: z.string().max(2_000).nullable().optional(),
});

async function ensureCanEdit(leadId: string, user: { id: string; role: import("@prisma/client").Role }) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new ApiError(404, "Lead not found");
  if (lead.ownerUserId === user.id) return lead;
  if (can(user.role, "lead:edit:any")) return lead;
  // v2.23.3 — teammates on the lead's sales team can edit it too.
  if (lead.teamId) {
    const { userTeamIds } = await import("@/lib/sales/teams");
    const teams = await userTeamIds(user.id);
    if (teams.includes(lead.teamId)) return lead;
  }
  throw new ApiError(403, "Forbidden");
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 50, include: { actor: { select: { name: true } } } },
        notes: { orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], include: { actor: { select: { name: true } } } },
        assessments: { orderBy: { createdAt: "desc" }, include: { answers: true } },
        serviceMatches: true,
        researchArtifacts: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (!leadIsVisible(user.role, user.id, lead.ownerUserId, lead.pipelineStage)) {
      throw new ApiError(403, "Forbidden");
    }
    return NextResponse.json({ lead });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const before = await ensureCanEdit(id, user);
    const json = await req.json();
    const data = updateSchema.parse(json);

    const cleaned: Record<string, unknown> = { ...data };
    if (cleaned.websiteUrl === "") cleaned.websiteUrl = null;
    if (cleaned.linkedinCompanyUrl === "") cleaned.linkedinCompanyUrl = null;
    if (cleaned.googleBusinessUrl === "") cleaned.googleBusinessUrl = null;
    if (cleaned.primaryContactEmail === "") cleaned.primaryContactEmail = null;
    if (typeof cleaned.expectedCloseDate === "string") {
      cleaned.expectedCloseDate = new Date(cleaned.expectedCloseDate);
    }

    // v2.23.3 — detect address changes so we can re-geocode after the
    // update. Compare against the `before` snapshot so we don't fire on
    // a no-op save.
    const ADDRESS_FIELDS = [
      "addressStreet",
      "addressCity",
      "addressState",
      "addressZip",
    ] as const;
    const addressChanged = ADDRESS_FIELDS.some((k) => {
      if (!(k in cleaned)) return false;
      const next = cleaned[k];
      const prev = (before as unknown as Record<string, unknown>)[k];
      return (next ?? null) !== (prev ?? null);
    });

    const after = await prisma.lead.update({ where: { id }, data: cleaned });
    const diff = diffForAudit(before as unknown as Record<string, unknown>, cleaned);
    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: id,
      action: "UPDATE",
      before: diff.before as never,
      after: diff.after as never,
      ...getAuditContext(req),
    });

    // v2.14 — if any scoring-relevant field changed, re-run the
    // auto-score and upsert the scorecard. Wrapped in try/catch so a
    // scoring failure never breaks a lead save.
    const changedScoringField = Object.keys(cleaned).some((k) => SCORING_FIELDS.has(k));
    if (changedScoringField) {
      try {
        const scores = autoScoreQualification({
          industry: after.industry,
          seatCount: after.seatCount,
          addressCity: after.addressCity,
          addressState: after.addressState,
          executiveSponsorName: after.executiveSponsorName,
          currentMspSatisfaction: after.currentMspSatisfaction,
          cyberInsuranceRenewalDate: after.cyberInsuranceRenewalDate,
          complianceDrivers: after.complianceDrivers,
        });
        const total =
          scores.industryFit +
          scores.sizeFit +
          scores.geography +
          scores.growthPosture +
          scores.authority +
          scores.budget +
          scores.timeline +
          scores.complianceDriver;
        await prisma.qualificationScorecard.upsert({
          where: { leadId: id },
          create: {
            leadId: id,
            industryFit: scores.industryFit,
            sizeFit: scores.sizeFit,
            geography: scores.geography,
            growthPosture: scores.growthPosture,
            authority: scores.authority,
            budget: scores.budget,
            timeline: scores.timeline,
            complianceDriver: scores.complianceDriver,
            total,
            verdict: verdictFor(total),
            scoredByUserId: user.id,
            scoredAt: new Date(),
          },
          update: {
            industryFit: scores.industryFit,
            sizeFit: scores.sizeFit,
            geography: scores.geography,
            growthPosture: scores.growthPosture,
            authority: scores.authority,
            budget: scores.budget,
            timeline: scores.timeline,
            complianceDriver: scores.complianceDriver,
            total,
            verdict: verdictFor(total),
            scoredByUserId: user.id,
            scoredAt: new Date(),
          },
        });
      } catch (scoreErr) {
        // eslint-disable-next-line no-console
        console.warn("[lead/PATCH] auto-score failed (lead save still applied):", scoreErr);
      }
    }

    // v2.23.3 — if any address field changed, re-geocode + re-match
    // territory in the background. Mirrors the POST /api/leads pattern.
    if (addressChanged) {
      void (async () => {
        try {
          const { geocodeAddress } = await import("@/lib/geo/mapbox");
          const { matchTerritoryForLead } = await import("@/lib/sales/territories");
          const latLng = await geocodeAddress({
            street: after.addressStreet ?? undefined,
            city: after.addressCity ?? undefined,
            state: after.addressState ?? undefined,
            zip: after.addressZip ?? undefined,
          });
          const match = await matchTerritoryForLead({
            city: after.addressCity ?? undefined,
            state: after.addressState ?? undefined,
            zip: after.addressZip ?? undefined,
            latLng,
          });
          await prisma.lead.update({
            where: { id },
            data: {
              addressLat: latLng ? latLng.lat : null,
              addressLng: latLng ? latLng.lng : null,
              geocodedAt: latLng ? new Date() : null,
              ...(match ? { teamId: match.teamId, territoryId: match.id } : {}),
            },
          });
        } catch (geoErr) {
          // eslint-disable-next-line no-console
          console.warn("[lead/PATCH] geocode/territory re-match failed:", geoErr);
        }
      })();
    }

    return NextResponse.json({ lead: after });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "lead:delete")) throw new ApiError(403, "Forbidden");
    const { id } = await params;

    // Reason is required per PRD §10. Accept it in body or as ?reason= query.
    let reason: string | undefined;
    try {
      const body = (await req.json()) as { reason?: string } | null;
      reason = body?.reason?.trim();
    } catch {
      reason = new URL(req.url).searchParams.get("reason")?.trim() ?? undefined;
    }
    if (!reason) throw new ApiError(400, "Deletion reason is required.");

    const before = await prisma.lead.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "Not found");
    await prisma.lead.delete({ where: { id } });
    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: id,
      action: "DELETE",
      before: {
        ...(before as unknown as Record<string, unknown>),
        deletionReason: reason,
      },
      ...getAuditContext(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}

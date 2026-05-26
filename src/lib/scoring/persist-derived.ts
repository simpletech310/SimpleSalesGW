/**
 * v3.3.23 — Persist derived Services / Customer / Deal-Quality scores
 * back onto Lead so list, dashboard, pipeline, and detail views all
 * read the same numbers.
 *
 * Before this: Lead.{servicesScore,customerScore,dealQualityScore}
 * only moved when the legacy MSP-Fit Assessment was submitted. We
 * had a render-time fallback on the lead detail page (v3.3.21) but
 * the leads list, sales dashboards, and pipeline board kept showing 0.
 *
 * Now: every time qualification is saved or a lead's intake fields
 * change, we re-derive the three scores using the same engine
 * (computeAllServiceFits + qualification.total) and write them back.
 * MSP-Fit Assessment submissions still overwrite — that path was
 * always authoritative and remains so.
 */

import { prisma } from "@/lib/prisma";
import { computeAllServiceFits, type FitInput } from "@/lib/scoring/service-fit";

export async function recomputeAndStoreLeadScores(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { qualification: true },
  });
  if (!lead) return;

  const q = lead.qualification;

  const fitInput: FitInput = {
    industryFit: q?.industryFit ?? 0,
    sizeFit: q?.sizeFit ?? 0,
    geography: q?.geography ?? 0,
    growthPosture: q?.growthPosture ?? 0,
    authority: q?.authority ?? 0,
    budget: q?.budget ?? 0,
    timeline: q?.timeline ?? 0,
    complianceDriver: q?.complianceDriver ?? 0,
    industry: lead.industry,
    seatCount: lead.seatCount,
    siteCount: lead.siteCount,
    complianceDrivers: lead.complianceDrivers as string[],
    currentMspName: lead.currentMspName,
    currentMspSatisfaction: lead.currentMspSatisfaction,
    interestedServices: (lead.interestedServices ?? []) as string[],
    currentPhoneSystem: lead.currentPhoneSystem,
    currentPhonePainPoint: lead.currentPhonePainPoint,
    currentAccessControl: lead.currentAccessControl,
    currentAccessDoorCount: lead.currentAccessDoorCount,
    currentVideoSurveillance: lead.currentVideoSurveillance,
    currentVideoCameraCount: lead.currentVideoCameraCount,
    cablingStatus: lead.cablingStatus,
    expansionPlans: lead.expansionPlans,
    aiAdvisoryInterest: lead.aiAdvisoryInterest,
  };

  const fits = computeAllServiceFits(fitInput);
  const topFits = fits.slice(0, Math.min(4, fits.length));
  const avgTop =
    topFits.length === 0 ? 0 : Math.round(topFits.reduce((s, f) => s + f.score, 0) / topFits.length);
  const qTotal = q?.total ?? 0;

  // Same blend the lead-detail tiles render with so all surfaces agree.
  const servicesScore = avgTop;
  const customerScore = qTotal;
  const dealQualityScore = Math.round(avgTop * 0.5 + qTotal * 0.5);

  await prisma.lead.update({
    where: { id: leadId },
    data: { servicesScore, customerScore, dealQualityScore },
  });
}

/**
 * Field names on Lead whose change should trigger a score recompute.
 * Importing call sites (PATCH /api/leads/[id]) check the input keys
 * and call recomputeAndStoreLeadScores() when any of these touched.
 */
export const INTAKE_FIELDS_THAT_AFFECT_SCORE: ReadonlyArray<string> = [
  "industry",
  "seatCount",
  "siteCount",
  "complianceDrivers",
  "currentMspName",
  "currentMspSatisfaction",
  "interestedServices",
  "currentPhoneSystem",
  "currentPhonePainPoint",
  "currentAccessControl",
  "currentAccessDoorCount",
  "currentVideoSurveillance",
  "currentVideoCameraCount",
  "cablingStatus",
  "expansionPlans",
  "aiAdvisoryInterest",
];

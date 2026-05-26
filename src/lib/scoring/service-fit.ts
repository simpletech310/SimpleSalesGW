/**
 * v3.3.15 — Per-service fit scoring.
 *
 * A lead can be a strong IT fit but a weak VoIP fit (e.g., they already
 * have RingCentral with 4 years left on a contract). The existing
 * QualificationScorecard rolls everything into one 0-100 total —
 * useful for "should we pursue this account?" but not for "which
 * services should we lead with?"
 *
 * This module derives a 0-100 fit score per ServiceLine from signals
 * already on the Lead (qualification dims + multi-service intake +
 * industry). Pure function: no DB writes, computed at render time so
 * it stays accurate as the lead evolves.
 *
 * Scoring is heuristic, not exact:
 *   - Each service starts from a baseline shared across all services
 *     (size fit, authority, budget, timeline — these matter everywhere)
 *   - Service-specific signals (interestedServices checkbox, current
 *     state, pain points, industry weight, expansion plans) add or
 *     remove points
 *   - Result is capped at 0-100 with a verdict bucket
 *
 * The fits also feed AI prompts (sales-coach + research-summary) so the
 * AI knows which lines are strongest to lead with.
 */

import { Industry, ServiceLine } from "@prisma/client";

export type ServiceFit = {
  serviceLine: ServiceLine;
  label: string;
  /** 0-100 derived score. */
  score: number;
  /** Bucket label for the UI. */
  band: "strong" | "good" | "marginal" | "weak";
  /** Short bullets explaining the score. */
  reasons: string[];
};

export type FitInput = {
  // Generic qualification dims (any may be 0 if not scored)
  industryFit: number;        // 0-15
  sizeFit: number;            // 0-15
  geography: number;          // 0-10
  growthPosture: number;      // 0-10
  authority: number;          // 0-15
  budget: number;             // 0-15
  timeline: number;           // 0-10
  complianceDriver: number;   // 0-10
  // Lead context
  industry: Industry | string;
  seatCount: number | null;
  siteCount: number | null;
  complianceDrivers: string[];
  currentMspName: string | null;
  currentMspSatisfaction: string;
  // Multi-service intake (v3.3.11)
  interestedServices: string[];
  currentPhoneSystem: string | null;
  currentPhonePainPoint: string | null;
  currentAccessControl: string | null;
  currentAccessDoorCount: number | null;
  currentVideoSurveillance: string | null;
  currentVideoCameraCount: number | null;
  cablingStatus: string | null;
  expansionPlans: string | null;
  aiAdvisoryInterest: string | null;
};

const SERVICE_LABELS: Record<ServiceLine, string> = {
  MANAGED_IT:      "Managed IT",
  CYBERSECURITY:   "Cybersecurity",
  VOIP:            "VoIP / phones",
  ACCESS_CONTROL:  "Access control",
  VIDEO:           "Video surveillance",
  CABLING:         "Structured cabling",
  AI_ADVISORY:     "AI advisory",
  NIST_ASSESSMENT: "NIST / compliance",
  VCIO_RETAINER:   "vCIO retainer",
};

/**
 * Industry → per-service weight (0-15). Used as a starting bias before
 * intake signals refine it. Higher = better natural fit.
 */
const INDUSTRY_WEIGHTS: Record<string, Partial<Record<ServiceLine, number>>> = {
  MEDICAL: {
    MANAGED_IT: 12, CYBERSECURITY: 14, NIST_ASSESSMENT: 14, ACCESS_CONTROL: 12,
    VIDEO: 10, VOIP: 8, AI_ADVISORY: 9, VCIO_RETAINER: 10, CABLING: 8,
  },
  LEGAL: {
    MANAGED_IT: 13, CYBERSECURITY: 13, NIST_ASSESSMENT: 11, VOIP: 12,
    AI_ADVISORY: 11, VCIO_RETAINER: 10, ACCESS_CONTROL: 9, VIDEO: 7, CABLING: 7,
  },
  FEDERAL_CONTRACTING: {
    MANAGED_IT: 13, CYBERSECURITY: 15, NIST_ASSESSMENT: 15, ACCESS_CONTROL: 13,
    VIDEO: 11, VOIP: 8, AI_ADVISORY: 7, VCIO_RETAINER: 12, CABLING: 9,
  },
  MANUFACTURING: {
    MANAGED_IT: 12, CYBERSECURITY: 12, ACCESS_CONTROL: 13, VIDEO: 13,
    CABLING: 13, VOIP: 11, AI_ADVISORY: 10, VCIO_RETAINER: 9, NIST_ASSESSMENT: 8,
  },
  HOSPITALITY: {
    VIDEO: 14, ACCESS_CONTROL: 12, VOIP: 13, MANAGED_IT: 10, CYBERSECURITY: 10,
    CABLING: 11, AI_ADVISORY: 8, NIST_ASSESSMENT: 6, VCIO_RETAINER: 6,
  },
  FINANCIAL_SERVICES: {
    CYBERSECURITY: 14, NIST_ASSESSMENT: 13, MANAGED_IT: 12, VIDEO: 13,
    ACCESS_CONTROL: 13, VOIP: 10, VCIO_RETAINER: 11, AI_ADVISORY: 10, CABLING: 7,
  },
  PROFESSIONAL_SERVICES: {
    MANAGED_IT: 12, CYBERSECURITY: 11, VOIP: 12, AI_ADVISORY: 12,
    VCIO_RETAINER: 11, ACCESS_CONTROL: 9, VIDEO: 7, CABLING: 8, NIST_ASSESSMENT: 7,
  },
  EDUCATION: {
    MANAGED_IT: 11, CYBERSECURITY: 11, ACCESS_CONTROL: 12, VIDEO: 12,
    CABLING: 10, VOIP: 10, VCIO_RETAINER: 9, AI_ADVISORY: 9, NIST_ASSESSMENT: 8,
  },
  NONPROFIT: {
    MANAGED_IT: 10, CYBERSECURITY: 9, VOIP: 9, AI_ADVISORY: 7,
    ACCESS_CONTROL: 7, VIDEO: 7, VCIO_RETAINER: 7, CABLING: 6, NIST_ASSESSMENT: 6,
  },
  OTHER: {
    MANAGED_IT: 10, CYBERSECURITY: 10, VOIP: 9, ACCESS_CONTROL: 8,
    VIDEO: 8, CABLING: 7, AI_ADVISORY: 8, NIST_ASSESSMENT: 6, VCIO_RETAINER: 8,
  },
};

function bandFor(score: number): ServiceFit["band"] {
  if (score >= 75) return "strong";
  if (score >= 55) return "good";
  if (score >= 35) return "marginal";
  return "weak";
}

/**
 * Generic baseline shared by every service: size + authority + budget +
 * timeline. These dims matter regardless of which line we're scoring.
 * Out of 40 points (15+15+10+0 from budget, half-weighted timeline).
 */
function baselineFor(i: FitInput): number {
  // Convert dims to 0-1 normalized contributions.
  // sizeFit (0-15) × 1.5  → up to 22.5
  // authority (0-15) × 1.0 → up to 15
  // budget (0-15) × 1.0    → up to 15
  // timeline (0-10) × 0.5  → up to 5
  return Math.min(60, i.sizeFit * 1.5 + i.authority * 1.0 + i.budget * 1.0 + i.timeline * 0.5);
}

/**
 * Cap and clamp a contribution so a single signal can't dominate.
 */
function bounded(value: number, max: number): number {
  return Math.max(0, Math.min(max, value));
}

export function computeServiceFit(line: ServiceLine, i: FitInput): ServiceFit {
  const reasons: string[] = [];
  // 1. Industry weight (0-15) — natural fit before any signals.
  const wTable = INDUSTRY_WEIGHTS[String(i.industry)] ?? INDUSTRY_WEIGHTS.OTHER;
  const indWeight = (wTable && wTable[line]) ?? 8;
  if (indWeight >= 13) reasons.push(`${String(i.industry).replace(/_/g, " ").toLowerCase()} is a strong natural fit`);
  else if (indWeight <= 7) reasons.push(`${String(i.industry).replace(/_/g, " ").toLowerCase()} is a lighter natural fit`);

  // 2. Baseline (size/authority/budget/timeline). Max 60.
  const baseline = baselineFor(i);
  if (i.budget >= 10) reasons.push("Budget signal present");
  if (i.authority >= 10) reasons.push("Decision-maker engaged");
  if (i.timeline >= 7) reasons.push("Compelling timeline / event");

  // 3. Service-specific signal adjustments. Each function returns
  // ±points + may push reasons.
  const intakeChecked = i.interestedServices.includes(line);
  if (intakeChecked) reasons.push("Rep flagged interest at intake");

  let extra = 0;
  switch (line) {
    case ServiceLine.MANAGED_IT: {
      extra += i.currentMspSatisfaction === "LEAVING" ? 15 : 0;
      if (i.currentMspSatisfaction === "LEAVING") reasons.push("Actively leaving current MSP");
      if (i.currentMspSatisfaction === "NEUTRAL") { extra += 6; reasons.push("Neutral on current MSP — open to alternatives"); }
      if (i.currentMspSatisfaction === "NONE") { extra += 10; reasons.push("No current MSP — clean slate"); }
      // Seat-band sweet spot 10-250
      if (i.seatCount != null && i.seatCount >= 10 && i.seatCount <= 250) { extra += 5; reasons.push(`${i.seatCount} seats in our sweet spot`); }
      else if (i.seatCount != null && (i.seatCount < 10 || i.seatCount > 500)) { extra -= 10; reasons.push(`${i.seatCount} seats outside the 10-250 band`); }
      break;
    }
    case ServiceLine.CYBERSECURITY: {
      // Compliance pressure or insurance is the dominant signal.
      if (i.complianceDrivers.length > 0) { extra += 12; reasons.push(`Compliance: ${i.complianceDrivers.join(", ")}`); }
      if (i.complianceDriver >= 7) extra += 5;
      // Below seat threshold drops the case
      if (i.seatCount != null && i.seatCount < 10) { extra -= 8; reasons.push("Below 10 seats — cyber pricing harder to justify"); }
      break;
    }
    case ServiceLine.VOIP: {
      // Phone signal: pain point text or "Leaving" current vendor
      if (i.currentPhonePainPoint && i.currentPhonePainPoint.trim().length > 0) { extra += 16; reasons.push(`Phone pain: ${i.currentPhonePainPoint.slice(0, 80)}`); }
      if (i.currentPhoneSystem && /old|legacy|on-?prem|pbx|aging|outdated|contract/i.test(i.currentPhoneSystem)) {
        extra += 10; reasons.push(`Current system: ${i.currentPhoneSystem}`);
      }
      // Knowledge-worker industries are naturally easier targets
      if (i.industry === "LEGAL" || i.industry === "PROFESSIONAL_SERVICES" || i.industry === "FINANCIAL_SERVICES") extra += 4;
      // No phone-system info AND not flagged = unknown
      if (!intakeChecked && !i.currentPhoneSystem && !i.currentPhonePainPoint) { extra -= 12; reasons.push("No phone-system signal captured"); }
      break;
    }
    case ServiceLine.ACCESS_CONTROL: {
      const doors = i.currentAccessDoorCount ?? 0;
      if (doors > 0) { extra += Math.min(12, doors * 2); reasons.push(`${doors} door${doors === 1 ? "" : "s"} captured`); }
      // Mechanical keys / none = upgrade opportunity
      if (i.currentAccessControl && /key|mechanical|none/i.test(i.currentAccessControl)) { extra += 10; reasons.push("Mechanical keys / no electronic access — upgrade fit"); }
      // Multi-site / expansion massively boosts
      if (i.siteCount && i.siteCount > 1) { extra += 6; reasons.push(`${i.siteCount} locations — multi-site access fit`); }
      if (i.expansionPlans && i.expansionPlans.trim().length > 0) extra += 4;
      // Industries where audit trail matters
      if (i.industry === "MEDICAL" || i.industry === "FINANCIAL_SERVICES" || i.industry === "FEDERAL_CONTRACTING") extra += 4;
      if (!intakeChecked && !i.currentAccessControl && doors === 0) { extra -= 12; reasons.push("No access-control signal captured"); }
      break;
    }
    case ServiceLine.VIDEO: {
      const cams = i.currentVideoCameraCount ?? 0;
      if (cams > 0) { extra += Math.min(12, cams * 1); reasons.push(`${cams} camera${cams === 1 ? "" : "s"} captured`); }
      if (i.currentVideoSurveillance && /none|old|analog|dvr|outdated/i.test(i.currentVideoSurveillance)) {
        extra += 10; reasons.push(`Current video: ${i.currentVideoSurveillance}`);
      }
      // Strong industry signals for video
      if (i.industry === "HOSPITALITY" || i.industry === "MANUFACTURING" || i.industry === "FINANCIAL_SERVICES") extra += 6;
      if (i.complianceDrivers.includes("PCI") || i.complianceDrivers.includes("HIPAA")) extra += 4;
      if (!intakeChecked && !i.currentVideoSurveillance && cams === 0) { extra -= 12; reasons.push("No video-surveillance signal captured"); }
      break;
    }
    case ServiceLine.CABLING: {
      // Expansion / new build / move is the main signal.
      if (i.cablingStatus && /new|build|expansion|move|relocat/i.test(i.cablingStatus)) {
        extra += 18; reasons.push(`Cabling: ${i.cablingStatus}`);
      }
      if (i.expansionPlans && i.expansionPlans.trim().length > 0) { extra += 12; reasons.push("Expansion plans captured"); }
      if (i.siteCount && i.siteCount > 1) extra += 4;
      // Without expansion or new build, cabling fit is poor.
      if (!intakeChecked && !i.cablingStatus && !i.expansionPlans) { extra -= 14; reasons.push("No new build / expansion signal — cabling fit limited"); }
      break;
    }
    case ServiceLine.AI_ADVISORY: {
      if (i.aiAdvisoryInterest && i.aiAdvisoryInterest.trim().length > 0) { extra += 18; reasons.push("AI questions surfaced in intake"); }
      // Knowledge-worker industries lean in
      if (["LEGAL", "PROFESSIONAL_SERVICES", "FINANCIAL_SERVICES", "MEDICAL"].includes(String(i.industry))) extra += 4;
      if (!intakeChecked && !i.aiAdvisoryInterest) { extra -= 10; reasons.push("No AI signal captured"); }
      break;
    }
    case ServiceLine.NIST_ASSESSMENT: {
      const drivers = i.complianceDrivers;
      if (drivers.length === 0) { extra -= 16; reasons.push("No compliance driver mentioned — don't lead with NIST"); }
      else { extra += 12 + Math.min(6, drivers.length * 2); reasons.push(`Compliance drivers: ${drivers.join(", ")}`); }
      if (drivers.some((d) => /CMMC|HIPAA|PCI|800-?171/i.test(d))) extra += 6;
      break;
    }
    case ServiceLine.VCIO_RETAINER: {
      // Need strategic guidance: between 50-500 seats + no IT leadership
      if (i.seatCount != null && i.seatCount >= 50 && i.seatCount <= 500) { extra += 8; reasons.push("Right seat band for vCIO"); }
      // No current MSP = no IT leader; LEAVING = bad current relationship
      if (i.currentMspSatisfaction === "NONE" || i.currentMspSatisfaction === "LEAVING") extra += 6;
      if (i.complianceDrivers.length > 0) extra += 4;
      break;
    }
  }

  // Combine: industry (15) + baseline (60) + extra (capped at 25) — total
  // raw 0-100. Then map to 0-100 final.
  const boundedExtra = bounded(extra, 25);
  const score = Math.max(0, Math.min(100, indWeight + baseline + boundedExtra));

  return {
    serviceLine: line,
    label: SERVICE_LABELS[line],
    score: Math.round(score),
    band: bandFor(score),
    reasons,
  };
}

export function computeAllServiceFits(i: FitInput): ServiceFit[] {
  const services: ServiceLine[] = [
    ServiceLine.MANAGED_IT,
    ServiceLine.CYBERSECURITY,
    ServiceLine.VOIP,
    ServiceLine.ACCESS_CONTROL,
    ServiceLine.VIDEO,
    ServiceLine.CABLING,
    ServiceLine.AI_ADVISORY,
    ServiceLine.NIST_ASSESSMENT,
    ServiceLine.VCIO_RETAINER,
  ];
  return services
    .map((s) => computeServiceFit(s, i))
    .sort((a, b) => b.score - a.score);
}

/**
 * Auto-score a lead against the 8-dimension Qualification Scorecard from
 * what's already on the Lead record. Designed to give Lin a sensible
 * starting baseline she can then tune by hand.
 *
 * Inputs we use:
 *   - industry              → industryFit (priority verticals score higher)
 *   - seatCount             → sizeFit (10–250 sweet spot)
 *   - addressCity / addressState → geography (Houston metro = 10)
 *   - executiveSponsorName  → authority (sponsor named → 12, else 6)
 *   - currentMspSatisfaction → budget (lower satisfaction = more budget unlock)
 *   - cyberInsuranceRenewalDate → timeline (closer renewal = higher urgency)
 *   - complianceDrivers     → complianceDriver (more drivers = higher)
 *
 * For dimensions where the lead has no useful signal we return a neutral
 * default; Lin will overwrite with judgment.
 */

import { ComplianceDriver, Industry, MspSatisfaction } from "@prisma/client";

export type AutoScoreInput = {
  industry?: Industry | null;
  seatCount?: number | null;
  addressCity?: string | null;
  addressState?: string | null;
  executiveSponsorName?: string | null;
  currentMspSatisfaction?: MspSatisfaction | null;
  cyberInsuranceRenewalDate?: Date | string | null;
  complianceDrivers?: ComplianceDriver[] | null;
};

export type AutoScoreResult = {
  industryFit: number;
  sizeFit: number;
  geography: number;
  growthPosture: number;
  authority: number;
  budget: number;
  timeline: number;
  complianceDriver: number;
  /** Human-readable notes the UI can show. */
  rationale: Partial<Record<keyof Omit<AutoScoreResult, "rationale">, string>>;
};

// Gateway's nine priority verticals (per the Service Catalog) — scored highest.
const PRIORITY_INDUSTRIES: Industry[] = [
  Industry.MEDICAL,
  Industry.LEGAL,
  Industry.FEDERAL_CONTRACTING,
  Industry.MANUFACTURING,
  Industry.HOSPITALITY,
  Industry.FINANCIAL_SERVICES,
  Industry.PROFESSIONAL_SERVICES,
];
const SECONDARY_INDUSTRIES: Industry[] = [Industry.EDUCATION, Industry.NONPROFIT];

function scoreIndustry(industry?: Industry | null): { score: number; note: string } {
  if (!industry || industry === Industry.OTHER) {
    return { score: 6, note: "Unclassified industry — score conservatively." };
  }
  if (PRIORITY_INDUSTRIES.includes(industry)) {
    return { score: 13, note: `${industry.replace(/_/g, " ")} is a Gateway priority vertical.` };
  }
  if (SECONDARY_INDUSTRIES.includes(industry)) {
    return { score: 9, note: `${industry.replace(/_/g, " ")} is a secondary vertical — pursue if fit.` };
  }
  return { score: 8, note: "Industry outside the top tier." };
}

function scoreSize(seatCount?: number | null): { score: number; note: string } {
  if (!seatCount || seatCount <= 0) return { score: 6, note: "Seat count unknown." };
  if (seatCount >= 25 && seatCount <= 150) {
    return { score: 14, note: `${seatCount} seats — Gateway sweet spot.` };
  }
  if (seatCount >= 10 && seatCount < 25) {
    return { score: 10, note: `${seatCount} seats — small end of fit.` };
  }
  if (seatCount > 150 && seatCount <= 250) {
    return { score: 12, note: `${seatCount} seats — Enterprise band.` };
  }
  if (seatCount > 250 && seatCount <= 500) {
    return { score: 8, note: `${seatCount} seats — over the seat ceiling. Confirm we can scope it.` };
  }
  if (seatCount > 500) {
    return { score: 5, note: `${seatCount} seats — too large for our standard bundles.` };
  }
  return { score: 4, note: `${seatCount} seats — too small to be efficient.` };
}

const HOUSTON_METRO = new Set([
  "houston", "katy", "sugar land", "pearland", "the woodlands", "spring",
  "humble", "kingwood", "missouri city", "richmond", "rosenberg", "league city",
  "friendswood", "pasadena", "deer park", "tomball", "cypress", "stafford",
]);

function scoreGeography(city?: string | null, state?: string | null): { score: number; note: string } {
  const c = (city ?? "").trim().toLowerCase();
  const s = (state ?? "").trim().toUpperCase();
  if (c && HOUSTON_METRO.has(c)) {
    return { score: 10, note: `${city} is in Gateway's home metro.` };
  }
  if (s === "TX") {
    return { score: 7, note: "Texas — strong regional fit." };
  }
  if (s) {
    return { score: 5, note: `Out-of-state (${s}) — remote engagement.` };
  }
  return { score: 5, note: "Geography unknown — defaulting to remote." };
}

function scoreGrowthPosture(): { score: number; note: string } {
  // No direct field on the Lead today — return a neutral baseline. Lin can adjust.
  return { score: 6, note: "Defaulting to stable. Adjust if you know they're growing or shrinking." };
}

function scoreAuthority(executiveSponsorName?: string | null): { score: number; note: string } {
  if (executiveSponsorName && executiveSponsorName.trim()) {
    return { score: 12, note: `Executive sponsor named: ${executiveSponsorName}.` };
  }
  return { score: 6, note: "No executive sponsor yet — confirm decision-maker is engaged." };
}

function scoreBudget(satisfaction?: MspSatisfaction | null): { score: number; note: string } {
  // Lower satisfaction with incumbent MSP often unlocks budget.
  if (!satisfaction || satisfaction === MspSatisfaction.NONE) {
    return { score: 8, note: "MSP satisfaction unknown — assume moderate budget signal." };
  }
  switch (satisfaction) {
    case MspSatisfaction.LEAVING:
      return { score: 13, note: "Leaving their current MSP — strong budget signal." };
    case MspSatisfaction.NEUTRAL:
      return { score: 9, note: "Neutral on current MSP — moderate budget signal." };
    case MspSatisfaction.HAPPY:
      return { score: 5, note: "Happy with current MSP — budget signal is weak." };
    default:
      return { score: 7, note: "Budget signal indeterminate." };
  }
}

function scoreTimeline(renewalDate?: Date | string | null): { score: number; note: string } {
  if (!renewalDate) {
    return { score: 5, note: "No compelling event on record. Ask about renewals or breaches." };
  }
  const d = renewalDate instanceof Date ? renewalDate : new Date(renewalDate);
  if (Number.isNaN(d.getTime())) return { score: 5, note: "Renewal date invalid." };
  const days = Math.floor((d.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return { score: 8, note: "Cyber-insurance renewal already passed — recheck status." };
  if (days <= 60) return { score: 10, note: `Cyber insurance renews in ${days} days — high urgency.` };
  if (days <= 180) return { score: 8, note: `Cyber insurance renews in ${days} days.` };
  if (days <= 365) return { score: 6, note: `Cyber renewal in ${days} days — moderate timeline.` };
  return { score: 4, note: `Cyber renewal over a year out (${days} days).` };
}

function scoreCompliance(drivers?: ComplianceDriver[] | null): { score: number; note: string } {
  const arr = drivers ?? [];
  const active = arr.filter((d) => d !== "NONE");
  if (active.length === 0) {
    return { score: 3, note: "No active compliance drivers." };
  }
  if (active.length >= 3) {
    return { score: 10, note: `Multiple active drivers (${active.join(", ")}) — strong compliance pull.` };
  }
  if (active.length === 2) {
    return { score: 8, note: `Two active drivers (${active.join(", ")}).` };
  }
  return { score: 6, note: `One active driver (${active[0]}).` };
}

/**
 * Run all 8 dimensions against the input Lead-shaped object.
 * Returns clamped integer scores + a per-dimension rationale note.
 */
export function autoScoreQualification(input: AutoScoreInput): AutoScoreResult {
  const industry = scoreIndustry(input.industry);
  const size = scoreSize(input.seatCount);
  const geography = scoreGeography(input.addressCity, input.addressState);
  const growth = scoreGrowthPosture();
  const authority = scoreAuthority(input.executiveSponsorName);
  const budget = scoreBudget(input.currentMspSatisfaction);
  const timeline = scoreTimeline(input.cyberInsuranceRenewalDate);
  const compliance = scoreCompliance(input.complianceDrivers);

  return {
    industryFit: industry.score,
    sizeFit: size.score,
    geography: geography.score,
    growthPosture: growth.score,
    authority: authority.score,
    budget: budget.score,
    timeline: timeline.score,
    complianceDriver: compliance.score,
    rationale: {
      industryFit: industry.note,
      sizeFit: size.note,
      geography: geography.note,
      growthPosture: growth.note,
      authority: authority.note,
      budget: budget.note,
      timeline: timeline.note,
      complianceDriver: compliance.note,
    },
  };
}

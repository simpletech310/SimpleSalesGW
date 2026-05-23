/**
 * Scoring engine — Section 9 of the PRD.
 *
 * Inputs: a map of questionId -> answer value (whatever the UI captured).
 * Outputs: Services Score, Customer Score, Deal Quality Score, service-match list,
 *          non-strategic flag.
 *
 * Weights are tunable via the SystemConfig table; this module exposes the
 * defaults via SCORING_DEFAULTS so the admin UI can patch them. Tests assert
 * the defaults exactly to catch accidental drift.
 */

import { ServiceLine, ServiceBundle, Industry } from "@prisma/client";

// ---------------------------------------------------------------------------
// Tunable defaults
// ---------------------------------------------------------------------------

export const SCORING_DEFAULTS = {
  servicesWeights: {
    [ServiceLine.MANAGED_IT]: 25,
    [ServiceLine.CYBERSECURITY]: 25,
    [ServiceLine.NIST_ASSESSMENT]: 20,
    [ServiceLine.AI_ADVISORY]: 10,
    [ServiceLine.VOIP]: 10,
    [ServiceLine.CABLING]: 5,
    [ServiceLine.ACCESS_CONTROL]: 3,
    [ServiceLine.VIDEO]: 3,
    [ServiceLine.VCIO_RETAINER]: 2,
  },
  customerWeights: {
    industry: 15,
    size: 15,
    geography: 10,
    growth: 10,
    authority: 15,
    budget: 15,
    timeline: 10,
    compliance: 10,
  },
  dealQualityBlend: {
    services: 0.45,
    customer: 0.55,
  },
  nonStrategic: {
    servicesBelow: 35,
    dealQualityBelow: 40,
  },
} as const;

export type ScoringConfig = typeof SCORING_DEFAULTS;

// ---------------------------------------------------------------------------
// Answer shape (loose — UI free-form, engine narrows internally)
// ---------------------------------------------------------------------------

export type AnswerMap = Record<string, unknown>;

export type ServiceMatchResult = {
  serviceLine: ServiceLine;
  fitScore: number;          // weight contributed (0..weight)
  reasoning: string;
  recommended: boolean;      // true if it fired
};

export type ScoringContext = {
  /** Executive sponsor present on the Lead (separate from assessment) */
  hasExecutiveSponsor?: boolean;
  /** Geography reachable from SoCal */
  geographyReachable?: boolean;
};

export type ScoringResult = {
  servicesScore: number;
  customerScore: number;
  dealQualityScore: number;
  nonStrategicFlag: boolean;
  serviceMatches: ServiceMatchResult[];
  suggestedBundle: ServiceBundle | null;
  bucket: "lighthouse" | "strong_fit" | "marginal" | "refer_or_wait" | "polite_decline";
  customerBreakdown: Record<keyof ScoringConfig["customerWeights"], number>;
};

// ---------------------------------------------------------------------------
// Helpers to read answers
// ---------------------------------------------------------------------------

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return [];
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function asBoolean(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) {
    const inner = (v as Record<string, unknown>).value;
    if (typeof inner === "boolean") return inner;
  }
  return undefined;
}

function nonEmptyText(v: unknown): boolean {
  const s = asString(v);
  if (s) return s.trim().length > 0;
  if (v && typeof v === "object" && "text" in (v as Record<string, unknown>)) {
    const t = (v as Record<string, unknown>).text;
    return typeof t === "string" && t.trim().length > 0;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Services Score
// ---------------------------------------------------------------------------

const STRATEGIC_PAIN_KEYWORDS = [
  "strategy", "strategic", "roadmap", "vision", "growth",
  "scale", "transformation", "compliance", "audit", "board",
  "merger", "acquisition", "expansion", "competitive",
];

function looksStrategic(text: string | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return STRATEGIC_PAIN_KEYWORDS.some((k) => lower.includes(k));
}

export function computeServicesScore(
  answers: AnswerMap,
  config: ScoringConfig = SCORING_DEFAULTS,
): { score: number; matches: ServiceMatchResult[] } {
  const q06 = asString(answers["Q06"]);
  const q08 = asString(answers["Q08"]);
  const q10 = asString(answers["Q10"]);
  const q11 = asBoolean(answers["Q11"]);
  const q12 = asBoolean(answers["Q12"]);
  const q13 = asStringArray(answers["Q13"]);
  const q14 = asBoolean(answers["Q14"]);
  const q15 = asString(answers["Q15"]);
  const q16 = asString(answers["Q16"]);
  const q17 = asString(answers["Q17"]);
  const q18 = asString(answers["Q18"]);
  const q22 = asBoolean(answers["Q22"]);
  const q24 = answers["Q24"];

  const matches: ServiceMatchResult[] = [];
  const w = config.servicesWeights;

  // Managed IT — Q06 ∈ {single in-house person, office manager, nobody} OR Q11 = yes
  {
    const fires =
      q06 === "single_in_house" || q06 === "office_manager" || q06 === "nobody" ||
      q11 === true;
    matches.push({
      serviceLine: ServiceLine.MANAGED_IT,
      fitScore: fires ? w[ServiceLine.MANAGED_IT] : 0,
      reasoning: fires
        ? "No dedicated IT team and/or recent outage history."
        : "Existing IT support coverage appears in place.",
      recommended: fires,
    });
  }

  // Cybersecurity foundation — weak Section C OR insurance renewal upcoming
  {
    const weakMfa = q15 === "few" || q15 === "no" || q15 === "unsure";
    const weakIrp = q16 === "no" || q16 === "unsure";
    const insuranceUpcoming = q12 === true;
    const fires = weakMfa || weakIrp || insuranceUpcoming;
    matches.push({
      serviceLine: ServiceLine.CYBERSECURITY,
      fitScore: fires ? w[ServiceLine.CYBERSECURITY] : 0,
      reasoning: fires
        ? `Security gaps: ${[
            weakMfa ? "MFA coverage weak" : null,
            weakIrp ? "no/unclear IR plan" : null,
            insuranceUpcoming ? "cyber insurance active" : null,
          ].filter(Boolean).join(", ")}.`
        : "Section C answers indicate baseline coverage.",
      recommended: fires,
    });
  }

  // NIST Assessment & Compliance — Q13 has any regulation (not NONE) OR Q14 = yes
  {
    const hasReg = q13.filter((v) => v !== "NONE").length > 0;
    const fires = hasReg || q14 === true;
    matches.push({
      serviceLine: ServiceLine.NIST_ASSESSMENT,
      fitScore: fires ? w[ServiceLine.NIST_ASSESSMENT] : 0,
      reasoning: fires
        ? "Active regulatory drivers or recent compliance questionnaire."
        : "No regulatory pressure identified.",
      recommended: fires,
    });
  }

  // AI Advisory — Q10 ∈ {yes_informally, interested} OR Q24 has content
  {
    const fires = q10 === "yes_informally" || q10 === "interested" || nonEmptyText(q24);
    matches.push({
      serviceLine: ServiceLine.AI_ADVISORY,
      fitScore: fires ? w[ServiceLine.AI_ADVISORY] : 0,
      reasoning: fires
        ? "Unsanctioned/exploratory AI use or stalled AI initiative."
        : "No AI signal.",
      recommended: fires,
    });
  }

  // VoIP — Q08 ∈ {on_prem_pbx, cell_only}
  {
    const fires = q08 === "on_prem_pbx" || q08 === "cell_only";
    matches.push({
      serviceLine: ServiceLine.VOIP,
      fitScore: fires ? w[ServiceLine.VOIP] : 0,
      reasoning: fires ? "Legacy or absent telephony platform." : "Hosted VoIP already in place.",
      recommended: fires,
    });
  }

  // Cabling / Build-Out — Q22 = yes
  {
    const fires = q22 === true;
    matches.push({
      serviceLine: ServiceLine.CABLING,
      fitScore: fires ? w[ServiceLine.CABLING] : 0,
      reasoning: fires ? "Planned move/build-out in next 12 months." : "No build-out planned.",
      recommended: fires,
    });
  }

  // Access Control — Q22 yes OR Q13 contains HIPAA/PCI OR Q11 yes
  {
    const fires =
      q22 === true ||
      q13.includes("HIPAA") || q13.includes("PCI") ||
      q11 === true;
    matches.push({
      serviceLine: ServiceLine.ACCESS_CONTROL,
      fitScore: fires ? w[ServiceLine.ACCESS_CONTROL] : 0,
      reasoning: fires
        ? "Build-out, regulated-data presence, or recent outage signals physical security need."
        : "No physical-access trigger.",
      recommended: fires,
    });
  }

  // Video — same triggers as Access Control per PRD (grouped "Access Control / Video")
  {
    const fires =
      q22 === true ||
      q13.includes("HIPAA") || q13.includes("PCI") ||
      q11 === true;
    matches.push({
      serviceLine: ServiceLine.VIDEO,
      fitScore: fires ? w[ServiceLine.VIDEO] : 0,
      reasoning: fires
        ? "Build-out, regulated-data presence, or outage history suggests video monitoring."
        : "No video-surveillance trigger.",
      recommended: fires,
    });
  }

  // vCIO Retainer — Q06 = in_house_team AND strategic-sounding Q17/Q18
  {
    const fires = q06 === "in_house_team" && (looksStrategic(q17) || looksStrategic(q18));
    matches.push({
      serviceLine: ServiceLine.VCIO_RETAINER,
      fitScore: fires ? w[ServiceLine.VCIO_RETAINER] : 0,
      reasoning: fires
        ? "In-house team with strategic-level pain — vCIO complement fits."
        : "No vCIO retainer trigger.",
      recommended: fires,
    });
  }

  const raw = matches.reduce((s, m) => s + m.fitScore, 0);
  const score = Math.min(100, raw);
  return { score, matches };
}

// ---------------------------------------------------------------------------
// Customer Score
// ---------------------------------------------------------------------------

const NINE_MARKETS: ReadonlySet<Industry> = new Set([
  Industry.MEDICAL,
  Industry.LEGAL,
  Industry.FEDERAL_CONTRACTING,
  Industry.MANUFACTURING,
  Industry.HOSPITALITY,
  Industry.FINANCIAL_SERVICES,
  Industry.PROFESSIONAL_SERVICES,
  Industry.EDUCATION,
  Industry.NONPROFIT,
]);

const ADJACENT_MARKETS: ReadonlySet<Industry> = new Set<Industry>([]);

function industryFit(industryValue: string | undefined): number {
  if (!industryValue) return 0;
  if (NINE_MARKETS.has(industryValue as Industry)) return 15;
  if (ADJACENT_MARKETS.has(industryValue as Industry)) return 8;
  return 0;
}

function sizeFit(employees: number | undefined): number {
  if (employees === undefined) return 0;
  if (employees >= 100 && employees <= 200) return 15;
  if ((employees >= 50 && employees <= 99) || (employees >= 201 && employees <= 250)) return 12;
  if (employees >= 25 && employees <= 49) return 8;
  if (employees >= 10 && employees <= 24) return 4;
  return 0;
}

function growthFit(outlook: string[]): number {
  if (outlook.includes("hiring") || outlook.includes("new_location") || outlook.includes("ma")) return 10;
  if (outlook.includes("stable")) return 5;
  if (outlook.includes("contracting")) return 0;
  return 0;
}

function authorityFit(ctx: ScoringContext, q21Text: string | undefined): number {
  if (ctx.hasExecutiveSponsor) return 15;
  if (!q21Text) return 0;
  const t = q21Text.toLowerCase();
  if (/\b(ceo|coo|cfo|cio|cto|owner|president|founder|partner|managing partner)\b/.test(t)) return 15;
  if (/\b(director|vp|vice president|head of|manager)\b/.test(t)) return 8;
  return 0;
}

function budgetFit(q20: string | undefined): number {
  switch (q20) {
    case "approved": return 15;
    case "being_planned": return 10;
    case "need_to_make_case": return 5;
    default: return 0;
  }
}

function timelineFit(q19: string | undefined): number {
  switch (q19) {
    case "immediate": return 10;
    case "30_days": return 8;
    case "90_days": return 5;
    case "this_year": return 2;
    default: return 0;
  }
}

function complianceFit(industry: string | undefined, q13: string[]): number {
  const hasActive = q13.filter((v) => v !== "NONE").length > 0;
  if (hasActive) return 10;
  const regulatedIndustries: ReadonlyArray<string> = [
    Industry.MEDICAL, Industry.LEGAL, Industry.FEDERAL_CONTRACTING,
    Industry.FINANCIAL_SERVICES, Industry.EDUCATION,
  ];
  if (industry && regulatedIndustries.includes(industry)) return 5;
  return 0;
}

export function computeCustomerScore(
  answers: AnswerMap,
  context: ScoringContext = {},
): { score: number; breakdown: ScoringResult["customerBreakdown"] } {
  const industry = asString(answers["Q01"]);
  const employees = asNumber(answers["Q02"]);
  const outlook = asStringArray(answers["Q05"]);
  const q13 = asStringArray(answers["Q13"]);
  const q19 = asString(answers["Q19"]);
  const q20 = asString(answers["Q20"]);
  const q21 = asString(answers["Q21"]);

  const breakdown = {
    industry: industryFit(industry),
    size: sizeFit(employees),
    geography: context.geographyReachable === false ? 0 : 10,
    growth: growthFit(outlook),
    authority: authorityFit(context, q21),
    budget: budgetFit(q20),
    timeline: timelineFit(q19),
    compliance: complianceFit(industry, q13),
  };
  const total = Object.values(breakdown).reduce((s, n) => s + n, 0);
  return { score: Math.min(100, total), breakdown };
}

// ---------------------------------------------------------------------------
// Deal Quality + bucket + suggested bundle
// ---------------------------------------------------------------------------

function bucketFor(score: number): ScoringResult["bucket"] {
  if (score >= 85) return "lighthouse";
  if (score >= 70) return "strong_fit";
  if (score >= 50) return "marginal";
  if (score >= 30) return "refer_or_wait";
  return "polite_decline";
}

function pickBundle(matches: ServiceMatchResult[]): ServiceBundle | null {
  const recs = new Set(matches.filter((m) => m.recommended).map((m) => m.serviceLine));
  if (recs.size === 0) return null;
  const hasMI = recs.has(ServiceLine.MANAGED_IT);
  const hasSec = recs.has(ServiceLine.CYBERSECURITY);
  const hasNist = recs.has(ServiceLine.NIST_ASSESSMENT);
  const hasVoip = recs.has(ServiceLine.VOIP);
  const hasBuild = recs.has(ServiceLine.CABLING) || recs.has(ServiceLine.ACCESS_CONTROL) || recs.has(ServiceLine.VIDEO);
  const hasAI = recs.has(ServiceLine.AI_ADVISORY);

  if (hasNist && hasSec) return ServiceBundle.COMPLIANCE_PLUS;
  if (hasMI && hasSec && (hasVoip || hasBuild || hasAI)) return ServiceBundle.ENTERPRISE;
  if (hasMI && hasSec) return ServiceBundle.PROFESSIONAL;
  if (hasMI || hasSec) return ServiceBundle.ESSENTIAL;
  return ServiceBundle.CUSTOM;
}

export function computeScores(
  answers: AnswerMap,
  context: ScoringContext = {},
  config: ScoringConfig = SCORING_DEFAULTS,
): ScoringResult {
  const services = computeServicesScore(answers, config);
  const customer = computeCustomerScore(answers, context);
  const blended =
    services.score * config.dealQualityBlend.services +
    customer.score * config.dealQualityBlend.customer;
  const dealQualityScore = Math.round(blended);
  const nonStrategicFlag =
    services.score < config.nonStrategic.servicesBelow ||
    dealQualityScore < config.nonStrategic.dealQualityBelow;
  return {
    servicesScore: services.score,
    customerScore: customer.score,
    dealQualityScore,
    nonStrategicFlag,
    serviceMatches: services.matches,
    suggestedBundle: pickBundle(services.matches),
    bucket: bucketFor(dealQualityScore),
    customerBreakdown: customer.breakdown,
  };
}

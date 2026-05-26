/**
 * Gateway TelNet pricing catalog.
 *
 * Source-of-truth defaults live in this file. Marcelo can override any field
 * at runtime via Superadmin → Pricing (SystemConfig key `pricing.catalog`).
 *
 * IMPORTANT: prices below are industry-typical placeholders — every entry in
 * 06-Service-Catalog and 08-Bundles-and-Process says "TBD" today. Replace via
 * the admin UI once Gateway publishes its Internal Pricing Sheet.
 *
 * Per-seat MRR (monthly recurring revenue) tiers down with seat count.
 * Floor = the lowest per-seat MRR Sales Manager can approve. Below-floor
 * pricing auto-routes to COO regardless of discount %.
 * Onboarding = base fee + per-seat addition, one-time at start.
 */

import { ServiceBundle, ServiceLine } from "@prisma/client";

export type SeatTier = {
  /** Inclusive seat range. */
  minSeats: number;
  maxSeats: number;
  /** Sticker MRR per seat at this band. */
  perSeatMrr: number;
  /** Floor MRR per seat at this band. */
  perSeatFloor: number;
};

/**
 * Per-service-line sub-tier label. The Internal Pricing Sheet uses these as
 * named tiers per offering (vCIO Lite/Standard/Complete, Managed IT
 * Foundation/Complete/Complete+, NIST Baseline/Industry Crosswalk/800-171+CMMC).
 * `tier` is optional — older catalog entries that pre-date v2.2 still pass
 * through as raw `ServiceLine` values.
 */
export type ServiceLineInclude =
  | ServiceLine
  | { serviceLine: ServiceLine; tier?: string };

/**
 * Sales-rep guide for a bundle or standalone service. Designed for the
 * Pricing page and lead-detail panels so reps can answer "what is this?"
 * "who's it for?" and "how do you actually deliver it?" without
 * pinging an SE. Keep each field short — total should be a glanceable
 * card, not a wall of text.
 */
export type SalesPitch = {
  /** 1-2 sentences in plain English: "what this actually is". */
  whatItIs: string;
  /** Who this is the right fit for — size, industry, situation cues. */
  bestFor: string;
  /** 2-4 outcomes the client gets, written as benefits not features. */
  howItHelps: ReadonlyArray<string>;
  /** Brief delivery overview — what onboarding/cadence looks like. */
  process: string;
};

export type BundleDefinition = {
  id: ServiceBundle;
  label: string;
  description: string;
  /** Per-seat MRR tiers. */
  seatTiers: ReadonlyArray<SeatTier>;
  /** Fixed one-time onboarding base + per-seat. */
  onboarding: { base: number; perSeat: number };
  /** Annual fees not captured by MRR (e.g. NIST assessment). */
  annualAddOns?: ReadonlyArray<{ label: string; amount: number }>;
  /** Service lines included. May be a bare ServiceLine or {serviceLine, tier?}. */
  includes: ReadonlyArray<ServiceLineInclude>;
  /** v3.3.4 — Rep-facing pitch card. Optional so older catalogs keep working. */
  pitch?: SalesPitch;
};

/** Normalize an `includes` entry to the structured `{serviceLine, tier}` form. */
export function normalizeInclude(entry: ServiceLineInclude): { serviceLine: ServiceLine; tier?: string } {
  if (typeof entry === "string") return { serviceLine: entry };
  return { serviceLine: entry.serviceLine, tier: entry.tier };
}

/** Flatten a bundle's includes to a uniform `{serviceLine, tier?}[]` for rendering. */
export function bundleIncludesNormalized(b: BundleDefinition): Array<{ serviceLine: ServiceLine; tier?: string }> {
  return b.includes.map(normalizeInclude);
}

/**
 * Service-line sub-tier definitions per the Internal Pricing Sheet.
 * These names are consumed by the catalog editor + PricingCard to surface the
 * named tier when an `includes` entry specifies one.
 */
export const SERVICE_LINE_TIERS: Partial<Record<ServiceLine, ReadonlyArray<string>>> = {
  VCIO_RETAINER: ["Lite", "Standard", "Complete"],
  MANAGED_IT: ["Foundation", "Complete", "Complete+"],
  NIST_ASSESSMENT: ["Baseline", "Industry Crosswalk", "800-171 + CMMC"],
  CYBERSECURITY: ["Essential", "Advanced", "SOC-managed"],
  AI_ADVISORY: ["Workshop", "Advisory", "Implementation"],
};

export type PricingCatalog = {
  version: string;
  currency: "USD";
  bundles: Record<ServiceBundle, BundleDefinition>;
  /**
   * Optional standalone service-line prices (not used in bundles).
   * Per-seat MRR for line-by-line quotes.
   */
  standalone: Partial<Record<ServiceLine, { perSeatMrr: number; perSeatFloor: number; oneTime: number }>>;
};

// ---------------------------------------------------------------------------
// Default catalog
// ---------------------------------------------------------------------------

export const DEFAULT_CATALOG: PricingCatalog = {
  version: "2026-05-26-pricing-reset",
  currency: "USD",
  bundles: {
    ESSENTIAL: {
      id: ServiceBundle.ESSENTIAL,
      label: "Foundation",
      description:
        "Managed IT + cybersecurity baseline for SMBs that need reliable IT and the security floor cyber insurance now requires.",
      // v3.3.4 — entry tier starts at $85 (was $189); reduced across the
      // board so we're not leading with the most aggressive sticker in
      // the market.
      seatTiers: [
        { minSeats: 10, maxSeats: 25, perSeatMrr: 109, perSeatFloor: 85 },
        { minSeats: 26, maxSeats: 75, perSeatMrr: 99,  perSeatFloor: 79 },
        { minSeats: 76, maxSeats: 150, perSeatMrr: 89, perSeatFloor: 72 },
      ],
      onboarding: { base: 1800, perSeat: 20 },
      includes: [
        { serviceLine: ServiceLine.MANAGED_IT, tier: "Foundation" },
        { serviceLine: ServiceLine.CYBERSECURITY, tier: "Essential" },
      ],
      pitch: {
        whatItIs:
          "Reliable day-to-day IT plus the cybersecurity baseline cyber insurance now demands. We monitor endpoints, patch systems, lock down identities, and verify backups.",
        bestFor:
          "Small businesses (10–150 seats) with no in-house IT, one overworked sysadmin, or an MSP that has stopped responding to tickets.",
        howItHelps: [
          "Tickets answered fast — first response under one business hour, most issues resolved same day",
          "MFA + EDR rolled out everywhere so insurance and audits stop flagging coverage gaps",
          "One predictable monthly bill — no surprise project invoices for routine work",
          "Backups tested every month so ransomware isn't game-over",
        ],
        process:
          "30-day onboarding: site survey → asset inventory → identity hardening → endpoint agent rollout → backup verification → first QBR at day 45.",
      },
    },
    PROFESSIONAL: {
      id: ServiceBundle.PROFESSIONAL,
      label: "Professional",
      description:
        "Foundation + voice + access. Fully-managed engagement for clients who want one accountable partner across the stack.",
      seatTiers: [
        { minSeats: 25,  maxSeats: 75,  perSeatMrr: 149, perSeatFloor: 119 },
        { minSeats: 76,  maxSeats: 150, perSeatMrr: 135, perSeatFloor: 109 },
        { minSeats: 151, maxSeats: 250, perSeatMrr: 125, perSeatFloor: 99 },
      ],
      onboarding: { base: 3500, perSeat: 30 },
      includes: [
        { serviceLine: ServiceLine.MANAGED_IT, tier: "Complete" },
        { serviceLine: ServiceLine.CYBERSECURITY, tier: "Advanced" },
        ServiceLine.VOIP,
        ServiceLine.ACCESS_CONTROL,
      ],
      pitch: {
        whatItIs:
          "Everything in Foundation plus hosted voice and door access. One vendor, one bill, one phone number to call when something breaks.",
        bestFor:
          "Mid-market businesses (25–250 seats) tired of juggling separate IT, voice, and security vendors who blame each other when issues arise.",
        howItHelps: [
          "Single point of accountability across IT, phones, and door security",
          "Hosted PBX with mobile twinning, e911, voicemail-to-email, and call analytics",
          "Card / fob / mobile credentials with full audit trail per door",
          "Everything visible in one portal — no logging into three vendor sites",
        ],
        process:
          "45-day onboarding stacks voice cutover + door reader install on top of Foundation. Phones live by week 2, access control by week 6, full handoff to steady-state at day 45.",
      },
    },
    COMPLIANCE_PLUS: {
      id: ServiceBundle.COMPLIANCE_PLUS,
      label: "Compliance+",
      description:
        "Foundation + NIST CSF assessment + quarterly remediation + vCIO Standard retainer. For HIPAA, PCI, CMMC, or insurance-driven clients.",
      seatTiers: [
        { minSeats: 25,  maxSeats: 75,  perSeatMrr: 179, perSeatFloor: 145 },
        { minSeats: 76,  maxSeats: 150, perSeatMrr: 165, perSeatFloor: 129 },
        { minSeats: 151, maxSeats: 250, perSeatMrr: 149, perSeatFloor: 119 },
      ],
      onboarding: { base: 5500, perSeat: 40 },
      annualAddOns: [{ label: "Annual NIST CSF assessment", amount: 8500 }],
      includes: [
        { serviceLine: ServiceLine.MANAGED_IT, tier: "Complete" },
        { serviceLine: ServiceLine.CYBERSECURITY, tier: "Advanced" },
        { serviceLine: ServiceLine.NIST_ASSESSMENT, tier: "Industry Crosswalk" },
        { serviceLine: ServiceLine.VCIO_RETAINER, tier: "Standard" },
      ],
      pitch: {
        whatItIs:
          "Foundation plus a documented NIST CSF assessment, a quarterly remediation cadence, and a Standard vCIO retainer — designed for clients under HIPAA, PCI, CMMC, or cyber-insurance pressure.",
        bestFor:
          "Regulated industries (medical, finance, defense, professional services) and any client whose insurance carrier is now demanding evidence of controls before renewal.",
        howItHelps: [
          "Annual NIST CSF assessment with a written gap analysis you can show your auditor",
          "Quarterly remediation sprints — not a report that gets filed and forgotten",
          "vCIO Standard: monthly strategy meeting plus board-ready security reporting",
          "Auditor-ready evidence binder maintained for you between assessments",
        ],
        process:
          "60-day onboarding includes NIST CSF baseline scan and remediation plan. Quarterly QBRs lead with security posture and roadmap progress against the gap list.",
      },
    },
    ENTERPRISE: {
      id: ServiceBundle.ENTERPRISE,
      label: "Enterprise (Full-Service)",
      description:
        "Managed IT (Complete+), SOC-managed cybersecurity, NIST 800-171/CMMC, vCIO Complete, AI advisory, voice, access, video, and build-out priority. White-glove for 150+ seat regulated clients.",
      // v3.3.4 — top tier capped at $249/seat (was $289); base onboarding
      // halved from $18k to $8.5k for the same scope.
      seatTiers: [
        { minSeats: 150, maxSeats: 250,  perSeatMrr: 249, perSeatFloor: 199 },
        { minSeats: 251, maxSeats: 500,  perSeatMrr: 219, perSeatFloor: 179 },
        { minSeats: 501, maxSeats: 9999, perSeatMrr: 189, perSeatFloor: 159 },
      ],
      onboarding: { base: 8500, perSeat: 50 },
      annualAddOns: [{ label: "Annual NIST CSF assessment", amount: 8500 }],
      includes: [
        { serviceLine: ServiceLine.MANAGED_IT, tier: "Complete+" },
        { serviceLine: ServiceLine.CYBERSECURITY, tier: "SOC-managed" },
        { serviceLine: ServiceLine.NIST_ASSESSMENT, tier: "800-171 + CMMC" },
        { serviceLine: ServiceLine.AI_ADVISORY, tier: "Advisory" },
        ServiceLine.VOIP,
        ServiceLine.ACCESS_CONTROL,
        ServiceLine.VIDEO,
        { serviceLine: ServiceLine.VCIO_RETAINER, tier: "Complete" },
      ],
      pitch: {
        whatItIs:
          "The complete stack: managed IT, SOC-monitored security, full compliance program, vCIO Complete, AI advisory, plus voice, access, and video. Build-out work gets queue priority.",
        bestFor:
          "Larger regulated organizations (150–2000+ seats) that want one accountable partner across IT, security, compliance, and strategic technology planning.",
        howItHelps: [
          "24/7 SOC: real analysts triage alerts, not just a dashboard you have to watch",
          "CMMC / 800-171 compliance program with audit-ready documentation maintained continuously",
          "Quarterly strategic roadmap session with your executive sponsor and CFO",
          "Build-out priority — your projects jump the install queue",
        ],
        process:
          "90-day onboarding with executive kickoff and parallel work streams (IT + security + voice + roadmap). Dedicated Technical Account Manager. Monthly executive QBRs once steady-state.",
      },
    },
    CUSTOM: {
      id: ServiceBundle.CUSTOM,
      label: "Custom / Scoped",
      description:
        "Modernization, AI-Forward, Build-Out, or vCIO+Cyber-only — scoped per engagement. Manual sticker entry required.",
      seatTiers: [],
      onboarding: { base: 0, perSeat: 0 },
      includes: [],
      pitch: {
        whatItIs:
          "Anything that doesn't fit a standard bundle: modernization sprints, AI workshops, build-out projects, or vCIO-only retainers.",
        bestFor:
          "Clients who already have one or two pieces solved (existing MSP, in-house IT) and want a partner only for the rest, or one-off transformation projects with a defined endpoint.",
        howItHelps: [
          "Scoped tightly to your situation — no padding, no upsell pressure",
          "Fixed-fee when scope is clear, time-and-materials when discovery is needed",
          "Can convert into a standing bundle later if the engagement goes well",
        ],
        process:
          "Discovery call → scoping document → pinned scope + price → kickoff. Typical engagements run 2–12 weeks.",
      },
    },
  },
  // v3.3.4 — ACCESS_CONTROL and VIDEO: no MRR per Gateway policy. The
  // hardware install is the deal; ongoing software licensing rolls into
  // bundle MRR when sold inside Professional/Enterprise.
  standalone: {
    MANAGED_IT:      { perSeatMrr: 89, perSeatFloor: 72, oneTime: 1800 },
    CYBERSECURITY:   { perSeatMrr: 49, perSeatFloor: 39, oneTime: 1200 },
    VOIP:            { perSeatMrr: 28, perSeatFloor: 22, oneTime: 900 },
    ACCESS_CONTROL:  { perSeatMrr: 0,  perSeatFloor: 0,  oneTime: 4000 },
    VIDEO:           { perSeatMrr: 0,  perSeatFloor: 0,  oneTime: 5500 },
    VCIO_RETAINER:   { perSeatMrr: 22, perSeatFloor: 16, oneTime: 0 },
    AI_ADVISORY:     { perSeatMrr: 25, perSeatFloor: 19, oneTime: 4500 },
    NIST_ASSESSMENT: { perSeatMrr: 0,  perSeatFloor: 0,  oneTime: 8500 },
    CABLING:         { perSeatMrr: 0,  perSeatFloor: 0,  oneTime: 0 }, // fully scoped
  },
};

/**
 * v3.3.4 — Rep-facing guide for standalone service lines. Same shape as
 * BundleDefinition.pitch but keyed by ServiceLine so the Pricing page,
 * ServiceQuoteCard, and LineItemPicker can all surface "what is this?"
 * without re-typing it everywhere.
 */
export const SERVICE_LINE_GUIDE: Partial<Record<ServiceLine, SalesPitch>> = {
  MANAGED_IT: {
    whatItIs:
      "Endpoint management, patching, helpdesk, network monitoring. The day-to-day 'keep the lights on' layer of IT.",
    bestFor:
      "Any business without dedicated IT staff, or with one person stretched too thin to be reactive and strategic.",
    howItHelps: [
      "Tickets answered fast — same-day resolution on most issues",
      "Patches applied on a schedule, not when something breaks",
      "Asset inventory + warranty tracking maintained for you",
      "Onboarding / offboarding workflows automated",
    ],
    process:
      "RMM agent deployed on every endpoint week 1. Helpdesk goes live week 2. First monthly health report at day 30.",
  },
  CYBERSECURITY: {
    whatItIs:
      "MFA, EDR, DNS filtering, phishing simulations, security awareness training. The control layer your insurance demands.",
    bestFor:
      "Anyone renewing cyber insurance, facing a vendor security questionnaire, or who's been targeted by phishing recently.",
    howItHelps: [
      "MFA rolled out everywhere — closes the #1 breach vector",
      "EDR with managed response — alerts get triaged, not piled up",
      "Monthly phishing simulation + remedial training for clickers",
      "Quarterly security posture report you can show your insurer",
    ],
    process:
      "Identity audit week 1, EDR rollout week 2, DNS filtering week 3, first phishing campaign week 4.",
  },
  VOIP: {
    whatItIs:
      "Hosted phone system — extensions, call routing, voicemail-to-email, mobile twinning, e911, optional recording.",
    bestFor:
      "Businesses still on a phone closet PBX, paying per-minute for long distance, or with mobile staff who can't make business calls from their cell.",
    howItHelps: [
      "Same business number rings desk phone, computer, and cell",
      "Voicemails arrive as email transcripts — searchable forever",
      "Auto-attendant + ring groups configured to match how you actually work",
      "Carrier-grade e911 with location accuracy",
    ],
    process:
      "Port numbers (3–4 weeks lead time with carrier), provision extensions, install handsets, train users on the mobile app. Cutover happens after hours.",
  },
  ACCESS_CONTROL: {
    whatItIs:
      "Door readers, badges or mobile credentials, audit trail per door. Replace physical keys with revocable digital access.",
    bestFor:
      "Anyone tired of rekeying after every staff change, or who needs an audit trail of who entered which space and when (medical, finance, defense).",
    howItHelps: [
      "Revoke an ex-employee's access in seconds instead of changing locks",
      "Time-based schedules — cleaners after hours, staff during business hours only",
      "Audit trail per door for compliance + after-hours investigation",
      "Mobile credentials so employees don't lose badges",
    ],
    process:
      "Door survey → reader spec → install with electrician for power + strikes → cloud software setup → credential enrollment. Typical 4–6 weeks depending on door count.",
  },
  VIDEO: {
    whatItIs:
      "IP cameras, NVR storage, remote viewing app, motion / line-cross analytics. Insurance-grade retention.",
    bestFor:
      "Retail, warehousing, professional services, and any business whose insurer requires camera coverage or that has experienced theft / liability incidents.",
    howItHelps: [
      "30–90 day retention so you can actually find the incident",
      "Remote viewing from any phone — check the office from anywhere",
      "Motion + line-cross analytics so you don't scrub hours of footage",
      "Camera footage is admissible — insurance and PD both accept it",
    ],
    process:
      "Site walk → camera placement plan → PoE network spec → install + NVR setup → app provisioning + retention configuration. 2–6 weeks depending on camera count.",
  },
  VCIO_RETAINER: {
    whatItIs:
      "Strategic technology advisor on retainer. Roadmap, budgeting, vendor management, executive reporting.",
    bestFor:
      "Companies between 'need an IT person' and 'need a CIO' — usually 50–500 seats — that want strategy-level technology guidance without a six-figure executive hire.",
    howItHelps: [
      "12–18 month technology roadmap aligned to your business goals",
      "Budget input and vendor negotiation help",
      "Board-ready monthly or quarterly reporting",
      "Single point of escalation across all your tech vendors",
    ],
    process:
      "Kickoff to set goals + cadence, then monthly strategy meeting with quarterly executive readout. Ad-hoc availability for vendor calls and contract reviews.",
  },
  AI_ADVISORY: {
    whatItIs:
      "AI tooling assessment, pilot deployment, governance policy, ROI measurement. Not selling hype — measurable outcomes.",
    bestFor:
      "Leaders who are tired of 'we should use AI' meetings and want a vendor that will tell them which two or three pilots are actually worth doing.",
    howItHelps: [
      "Honest read on which AI tools fit your workflows (and which don't)",
      "Governance policy + data handling rules so you don't leak PII",
      "Pilot deployment with measurable KPIs — hours saved, error rate, throughput",
      "Quarterly ROI review to scale what's working, kill what isn't",
    ],
    process:
      "Workshop (1–2 days) → opportunity map → pilot selection (2–3 high-leverage areas) → 60-day pilots with metrics → scale-or-kill decision per pilot.",
  },
  NIST_ASSESSMENT: {
    whatItIs:
      "Gap assessment against NIST CSF or 800-171 with a written remediation plan. Required for many compliance programs.",
    bestFor:
      "Anyone under HIPAA, PCI, CMMC, DFARS, or whose cyber insurance now requires evidence of a framework assessment.",
    howItHelps: [
      "Written gap analysis you can show your auditor or insurer",
      "Prioritized remediation roadmap — not a 200-page document you ignore",
      "Re-assessment annually so the binder stays current",
      "Crosswalk to your specific compliance driver (HIPAA, PCI, CMMC, etc.)",
    ],
    process:
      "Interviews + evidence collection (2–3 weeks) → scoring against the framework → written report + remediation plan → debrief with leadership.",
  },
  CABLING: {
    whatItIs:
      "Cat6 / Cat6a structured cabling install with certification testing. Per-drop pricing.",
    bestFor:
      "New builds, suite expansions, voice rollouts that need new drops, or anyone running cameras / access readers that need PoE.",
    howItHelps: [
      "Cable + termination + faceplate + test + cert all included per drop",
      "Certification report so the warranty actually applies",
      "Coordinated with voice / camera / access installs so trades don't trip each other",
      "Pulled to spec for whatever's coming next — not just what's installed today",
    ],
    process:
      "Walkthrough → drop count + path planning → pull + terminate + test + cert → handoff with cert report.",
  },
};

// ---------------------------------------------------------------------------
// Sticker math
// ---------------------------------------------------------------------------

export type StickerComputation = {
  bundleId: ServiceBundle;
  seatCount: number;
  perSeatMrr: number;
  perSeatFloor: number;
  monthlyMrr: number;
  monthlyFloor: number;
  onboardingBase: number;
  onboardingPerSeat: number;
  onboardingTotal: number;
  annualAddOns: ReadonlyArray<{ label: string; amount: number }>;
  tier: SeatTier | null;
  /** True when seatCount falls outside this bundle's published tiers. */
  outOfBand: boolean;
};

/** Pick the matching seat tier; falls back to the nearest band when out of range. */
export function tierFor(bundle: BundleDefinition, seatCount: number): { tier: SeatTier | null; outOfBand: boolean } {
  if (bundle.seatTiers.length === 0) return { tier: null, outOfBand: true };
  for (const t of bundle.seatTiers) {
    if (seatCount >= t.minSeats && seatCount <= t.maxSeats) return { tier: t, outOfBand: false };
  }
  // out-of-band — use the closest tier
  if (seatCount < bundle.seatTiers[0]!.minSeats) return { tier: bundle.seatTiers[0]!, outOfBand: true };
  return { tier: bundle.seatTiers[bundle.seatTiers.length - 1]!, outOfBand: true };
}

export function computeSticker(
  catalog: PricingCatalog,
  bundleId: ServiceBundle,
  seatCount: number,
): StickerComputation {
  const bundle = catalog.bundles[bundleId];
  const safeSeats = Math.max(1, Math.floor(seatCount));
  const { tier, outOfBand } = tierFor(bundle, safeSeats);
  const perSeatMrr = tier?.perSeatMrr ?? 0;
  const perSeatFloor = tier?.perSeatFloor ?? 0;
  const monthlyMrr = perSeatMrr * safeSeats;
  const monthlyFloor = perSeatFloor * safeSeats;
  const onboardingTotal = bundle.onboarding.base + bundle.onboarding.perSeat * safeSeats;
  return {
    bundleId,
    seatCount: safeSeats,
    perSeatMrr,
    perSeatFloor,
    monthlyMrr,
    monthlyFloor,
    onboardingBase: bundle.onboarding.base,
    onboardingPerSeat: bundle.onboarding.perSeat,
    onboardingTotal,
    annualAddOns: bundle.annualAddOns ?? [],
    tier,
    outOfBand,
  };
}

/** Returns true when the proposed MRR is below the bundle's effective monthly floor. */
export function isBelowFloor(sticker: StickerComputation, proposedMrr: number): boolean {
  if (sticker.monthlyFloor <= 0) return false;
  return proposedMrr < sticker.monthlyFloor;
}

/** Convenience: list all bundles in display order. */
export function listBundles(catalog: PricingCatalog): ReadonlyArray<BundleDefinition> {
  const order: ServiceBundle[] = [
    ServiceBundle.ESSENTIAL,
    ServiceBundle.PROFESSIONAL,
    ServiceBundle.COMPLIANCE_PLUS,
    ServiceBundle.ENTERPRISE,
    ServiceBundle.CUSTOM,
  ];
  return order.map((id) => catalog.bundles[id]);
}

// ---------------------------------------------------------------------------
// Currency formatting helper
// ---------------------------------------------------------------------------

export function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

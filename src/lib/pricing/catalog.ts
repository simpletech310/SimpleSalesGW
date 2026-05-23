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
  /** Service lines included. */
  includes: ReadonlyArray<ServiceLine>;
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
  version: "2026-05-23-defaults",
  currency: "USD",
  bundles: {
    ESSENTIAL: {
      id: ServiceBundle.ESSENTIAL,
      label: "Foundation",
      description:
        "Managed IT + cybersecurity baseline for SMBs that need reliable IT and the security floor cyber insurance now requires.",
      seatTiers: [
        { minSeats: 10, maxSeats: 25, perSeatMrr: 189, perSeatFloor: 149 },
        { minSeats: 26, maxSeats: 75, perSeatMrr: 169, perSeatFloor: 139 },
        { minSeats: 76, maxSeats: 150, perSeatMrr: 149, perSeatFloor: 129 },
      ],
      onboarding: { base: 4500, perSeat: 50 },
      includes: [ServiceLine.MANAGED_IT, ServiceLine.CYBERSECURITY],
    },
    PROFESSIONAL: {
      id: ServiceBundle.PROFESSIONAL,
      label: "Professional",
      description:
        "Foundation + voice + access. Fully-managed engagement for clients who want one throat to choke across the stack.",
      seatTiers: [
        { minSeats: 25, maxSeats: 75, perSeatMrr: 219, perSeatFloor: 179 },
        { minSeats: 76, maxSeats: 150, perSeatMrr: 199, perSeatFloor: 169 },
        { minSeats: 151, maxSeats: 250, perSeatMrr: 179, perSeatFloor: 149 },
      ],
      onboarding: { base: 6500, perSeat: 60 },
      includes: [
        ServiceLine.MANAGED_IT,
        ServiceLine.CYBERSECURITY,
        ServiceLine.VOIP,
        ServiceLine.ACCESS_CONTROL,
      ],
    },
    COMPLIANCE_PLUS: {
      id: ServiceBundle.COMPLIANCE_PLUS,
      label: "Compliance+",
      description:
        "Foundation + NIST CSF assessment + remediation cadence + vCIO Standard retainer. For HIPAA / PCI / CMMC / cyber-insurance-driven clients.",
      seatTiers: [
        { minSeats: 25, maxSeats: 75, perSeatMrr: 249, perSeatFloor: 209 },
        { minSeats: 76, maxSeats: 150, perSeatMrr: 229, perSeatFloor: 189 },
        { minSeats: 151, maxSeats: 250, perSeatMrr: 209, perSeatFloor: 175 },
      ],
      onboarding: { base: 9500, perSeat: 75 },
      annualAddOns: [{ label: "Annual NIST CSF assessment", amount: 8500 }],
      includes: [
        ServiceLine.MANAGED_IT,
        ServiceLine.CYBERSECURITY,
        ServiceLine.NIST_ASSESSMENT,
        ServiceLine.VCIO_RETAINER,
      ],
    },
    ENTERPRISE: {
      id: ServiceBundle.ENTERPRISE,
      label: "Enterprise (Full-Service)",
      description:
        "Everything: managed IT, cyber, NIST, vCIO Complete, AI advisory, voice, and build-out priority. For 150+ seat regulated clients.",
      seatTiers: [
        { minSeats: 150, maxSeats: 250, perSeatMrr: 289, perSeatFloor: 249 },
        { minSeats: 251, maxSeats: 500, perSeatMrr: 269, perSeatFloor: 229 },
        { minSeats: 501, maxSeats: 9999, perSeatMrr: 249, perSeatFloor: 209 },
      ],
      onboarding: { base: 18000, perSeat: 100 },
      annualAddOns: [{ label: "Annual NIST CSF assessment", amount: 8500 }],
      includes: [
        ServiceLine.MANAGED_IT,
        ServiceLine.CYBERSECURITY,
        ServiceLine.NIST_ASSESSMENT,
        ServiceLine.AI_ADVISORY,
        ServiceLine.VOIP,
        ServiceLine.ACCESS_CONTROL,
        ServiceLine.VIDEO,
        ServiceLine.VCIO_RETAINER,
      ],
    },
    CUSTOM: {
      id: ServiceBundle.CUSTOM,
      label: "Custom / Scoped",
      description:
        "Modernization, AI-Forward, Build-Out, or vCIO+Cyber-only — all scoped per engagement. Manual sticker entry required.",
      seatTiers: [],
      onboarding: { base: 0, perSeat: 0 },
      includes: [],
    },
  },
  standalone: {
    MANAGED_IT: { perSeatMrr: 139, perSeatFloor: 119, oneTime: 3500 },
    CYBERSECURITY: { perSeatMrr: 79, perSeatFloor: 65, oneTime: 2500 },
    VOIP: { perSeatMrr: 35, perSeatFloor: 28, oneTime: 1500 },
    ACCESS_CONTROL: { perSeatMrr: 12, perSeatFloor: 8, oneTime: 4000 },
    VIDEO: { perSeatMrr: 18, perSeatFloor: 12, oneTime: 5500 },
    VCIO_RETAINER: { perSeatMrr: 25, perSeatFloor: 18, oneTime: 0 },
    AI_ADVISORY: { perSeatMrr: 32, perSeatFloor: 25, oneTime: 6500 },
    NIST_ASSESSMENT: { perSeatMrr: 0, perSeatFloor: 0, oneTime: 12500 },
    CABLING: { perSeatMrr: 0, perSeatFloor: 0, oneTime: 0 }, // fully scoped
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

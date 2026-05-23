import { describe, expect, it } from "vitest";
import { ServiceBundle } from "@prisma/client";
import {
  DEFAULT_CATALOG,
  computeSticker,
  isBelowFloor,
  listBundles,
  tierFor,
} from "@/lib/pricing/catalog";

describe("DEFAULT_CATALOG sanity", () => {
  it("contains all 5 bundle ids", () => {
    for (const b of Object.values(ServiceBundle)) {
      expect(DEFAULT_CATALOG.bundles[b]).toBeDefined();
    }
  });

  it("seat tiers don't have negative or zero per-seat pricing for non-custom bundles", () => {
    for (const id of [
      ServiceBundle.ESSENTIAL,
      ServiceBundle.PROFESSIONAL,
      ServiceBundle.COMPLIANCE_PLUS,
      ServiceBundle.ENTERPRISE,
    ]) {
      const b = DEFAULT_CATALOG.bundles[id];
      expect(b.seatTiers.length).toBeGreaterThan(0);
      for (const t of b.seatTiers) {
        expect(t.perSeatMrr).toBeGreaterThan(0);
        expect(t.perSeatFloor).toBeGreaterThan(0);
        expect(t.perSeatFloor).toBeLessThanOrEqual(t.perSeatMrr);
        expect(t.minSeats).toBeLessThanOrEqual(t.maxSeats);
      }
    }
  });

  it("CUSTOM bundle has no tiers (manual scope)", () => {
    expect(DEFAULT_CATALOG.bundles.CUSTOM.seatTiers).toHaveLength(0);
  });

  it("listBundles returns all 5 in display order", () => {
    const list = listBundles(DEFAULT_CATALOG);
    expect(list.map((b) => b.id)).toEqual([
      "ESSENTIAL", "PROFESSIONAL", "COMPLIANCE_PLUS", "ENTERPRISE", "CUSTOM",
    ]);
  });
});

describe("tierFor", () => {
  it("matches the band that contains the seat count", () => {
    const b = DEFAULT_CATALOG.bundles.ESSENTIAL;
    const r = tierFor(b, 50);
    expect(r.tier?.minSeats).toBe(26);
    expect(r.outOfBand).toBe(false);
  });

  it("flags below-min as out-of-band", () => {
    const b = DEFAULT_CATALOG.bundles.ESSENTIAL;
    const r = tierFor(b, 5);
    expect(r.outOfBand).toBe(true);
    expect(r.tier).toBeTruthy();
  });

  it("flags above-max as out-of-band", () => {
    const b = DEFAULT_CATALOG.bundles.ESSENTIAL;
    const r = tierFor(b, 500);
    expect(r.outOfBand).toBe(true);
    expect(r.tier?.maxSeats).toBe(150);
  });

  it("returns null tier for bundles with no tiers (CUSTOM)", () => {
    const r = tierFor(DEFAULT_CATALOG.bundles.CUSTOM, 100);
    expect(r.tier).toBeNull();
    expect(r.outOfBand).toBe(true);
  });
});

describe("computeSticker", () => {
  it("computes MRR + onboarding for a Foundation 50-seat client", () => {
    const s = computeSticker(DEFAULT_CATALOG, ServiceBundle.ESSENTIAL, 50);
    expect(s.perSeatMrr).toBe(169);
    expect(s.monthlyMrr).toBe(50 * 169);
    expect(s.onboardingBase).toBe(4500);
    expect(s.onboardingPerSeat).toBe(50);
    expect(s.onboardingTotal).toBe(4500 + 50 * 50);
  });

  it("computes Enterprise 200-seat sticker", () => {
    const s = computeSticker(DEFAULT_CATALOG, ServiceBundle.ENTERPRISE, 200);
    expect(s.monthlyMrr).toBe(200 * 289);
    expect(s.outOfBand).toBe(false);
    expect(s.annualAddOns.length).toBeGreaterThan(0);
  });

  it("clamps seatCount to >= 1", () => {
    const s = computeSticker(DEFAULT_CATALOG, ServiceBundle.PROFESSIONAL, 0);
    expect(s.seatCount).toBe(1);
  });

  it("CUSTOM bundle yields zero sticker (manual scope)", () => {
    const s = computeSticker(DEFAULT_CATALOG, ServiceBundle.CUSTOM, 100);
    expect(s.monthlyMrr).toBe(0);
    expect(s.onboardingTotal).toBe(0);
    expect(s.tier).toBeNull();
  });
});

describe("isBelowFloor", () => {
  it("detects below-floor proposals", () => {
    const s = computeSticker(DEFAULT_CATALOG, ServiceBundle.ESSENTIAL, 50);
    // floor at 50 seats: $139/seat = $6,950/mo
    expect(isBelowFloor(s, 6000)).toBe(true);
    expect(isBelowFloor(s, 7000)).toBe(false);
  });

  it("returns false for zero-floor bundles (CUSTOM)", () => {
    const s = computeSticker(DEFAULT_CATALOG, ServiceBundle.CUSTOM, 100);
    expect(isBelowFloor(s, 0)).toBe(false);
    expect(isBelowFloor(s, 50_000)).toBe(false);
  });

  it("exactly-at-floor is NOT below floor", () => {
    const s = computeSticker(DEFAULT_CATALOG, ServiceBundle.ESSENTIAL, 50);
    expect(isBelowFloor(s, s.monthlyFloor)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { ServiceBundle, ServiceLine } from "@prisma/client";
import {
  DEFAULT_CATALOG,
  SERVICE_LINE_TIERS,
  bundleIncludesNormalized,
  computeSticker,
  isBelowFloor,
  listBundles,
  normalizeInclude,
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

describe("service-line sub-tier shape (v2.2)", () => {
  it("normalizeInclude handles bare ServiceLine", () => {
    const n = normalizeInclude(ServiceLine.VOIP);
    expect(n.serviceLine).toBe(ServiceLine.VOIP);
    expect(n.tier).toBeUndefined();
  });

  it("normalizeInclude handles { serviceLine, tier } shape", () => {
    const n = normalizeInclude({ serviceLine: ServiceLine.MANAGED_IT, tier: "Complete+" });
    expect(n.serviceLine).toBe(ServiceLine.MANAGED_IT);
    expect(n.tier).toBe("Complete+");
  });

  it("bundleIncludesNormalized returns uniform shape from a mixed bundle", () => {
    const norm = bundleIncludesNormalized(DEFAULT_CATALOG.bundles[ServiceBundle.ENTERPRISE]);
    expect(norm.length).toBeGreaterThan(0);
    for (const n of norm) {
      expect(typeof n.serviceLine).toBe("string");
      expect(n.tier === undefined || typeof n.tier === "string").toBe(true);
    }
  });

  it("ENTERPRISE bundle carries explicit tier labels for vCIO + Managed IT + NIST", () => {
    const norm = bundleIncludesNormalized(DEFAULT_CATALOG.bundles[ServiceBundle.ENTERPRISE]);
    const vcio = norm.find((n) => n.serviceLine === ServiceLine.VCIO_RETAINER);
    const mit = norm.find((n) => n.serviceLine === ServiceLine.MANAGED_IT);
    const nist = norm.find((n) => n.serviceLine === ServiceLine.NIST_ASSESSMENT);
    expect(vcio?.tier).toBe("Complete");
    expect(mit?.tier).toBe("Complete+");
    expect(nist?.tier).toBe("800-171 + CMMC");
  });

  it("SERVICE_LINE_TIERS publishes the named tiers per offering", () => {
    expect(SERVICE_LINE_TIERS.VCIO_RETAINER).toEqual(["Lite", "Standard", "Complete"]);
    expect(SERVICE_LINE_TIERS.MANAGED_IT).toEqual(["Foundation", "Complete", "Complete+"]);
    expect(SERVICE_LINE_TIERS.NIST_ASSESSMENT).toEqual(["Baseline", "Industry Crosswalk", "800-171 + CMMC"]);
  });

  it("every default catalog tier referenced exists in SERVICE_LINE_TIERS", () => {
    const list = [ServiceBundle.ESSENTIAL, ServiceBundle.PROFESSIONAL, ServiceBundle.COMPLIANCE_PLUS, ServiceBundle.ENTERPRISE];
    for (const id of list) {
      const norm = bundleIncludesNormalized(DEFAULT_CATALOG.bundles[id]);
      for (const inc of norm) {
        if (!inc.tier) continue;
        const allowed = SERVICE_LINE_TIERS[inc.serviceLine];
        if (!allowed) continue; // not every line publishes named tiers
        expect(allowed).toContain(inc.tier);
      }
    }
  });
});

/**
 * v3.3.28 — buildEnrichmentUpdate merge semantics.
 *
 * The whole point of this helper is that an empty/failed research pass
 * NEVER clobbers a value the rep already typed in. These tests pin that
 * contract: null/undefined/empty-string scalars and empty arrays skip;
 * non-empty values overwrite; arrays REPLACE wholesale (the agent's
 * view is authoritative for that pass).
 */

import { describe, expect, it } from "vitest";
import { buildEnrichmentUpdate, isNonEmpty } from "@/lib/lead-enrich/persist";
import type { AgentBriefing } from "@/lib/lead-enrich/agent";

describe("isNonEmpty", () => {
  it("treats null/undefined/empty/whitespace as empty", () => {
    expect(isNonEmpty(null)).toBe(false);
    expect(isNonEmpty(undefined)).toBe(false);
    expect(isNonEmpty("")).toBe(false);
    expect(isNonEmpty("   ")).toBe(false);
  });
  it("treats real values as non-empty", () => {
    expect(isNonEmpty("x")).toBe(true);
    expect(isNonEmpty(0)).toBe(true); // numbers other than NaN are content
    expect(isNonEmpty(false)).toBe(true);
    expect(isNonEmpty([])).toBe(true); // an empty array is still "a value present"
  });
});

const emptyBriefing: AgentBriefing = {
  summary: "",
  fitSignals: [],
  suggestedQuestions: [],
  risks: [],
};

describe("buildEnrichmentUpdate — skip rules (protect existing manual data)", () => {
  it("an entirely empty briefing produces no field writes besides timestamps", () => {
    const { data, diff } = buildEnrichmentUpdate(emptyBriefing);
    // Only the two timestamp fields should be set when nothing was found.
    expect(Object.keys(data).sort()).toEqual([
      "enrichmentCompletedAt",
      "researchCompletedAt",
    ]);
    expect(diff.updatedFields).toEqual([]);
    // Skipped list captures every UNCONDITIONALLY-considered field (the 3
    // card arrays + prose summary). Sub-object branches like
    // businessProfile/techFootprint only contribute entries to
    // skippedFields when the briefing actually provides that sub-object.
    expect(diff.skippedFields).toContain("researchSummary");
    expect(diff.skippedFields).toContain("researchFitSignals");
    expect(diff.skippedFields).toContain("researchSuggestedQuestions");
    expect(diff.skippedFields).toContain("researchRisks");
  });

  it("when sub-objects are provided, their null fields appear in skippedFields", () => {
    const briefing: AgentBriefing = {
      ...emptyBriefing,
      businessProfile: {
        foundedYear: null,
        estimatedAnnualRevenue: null,
        employeeCountBand: null,
        registeredEntityType: null,
      },
    };
    const { diff } = buildEnrichmentUpdate(briefing);
    expect(diff.skippedFields).toContain("foundedYear");
    expect(diff.skippedFields).toContain("estimatedAnnualRevenue");
    expect(diff.skippedFields).toContain("employeeCountBand");
    expect(diff.skippedFields).toContain("registeredEntityType");
  });

  it("null/undefined scalars skip (don't clobber existing values)", () => {
    const briefing: AgentBriefing = {
      ...emptyBriefing,
      businessProfile: {
        foundedYear: null,
        estimatedAnnualRevenue: null,
        employeeCountBand: undefined,
        registeredEntityType: "",
      },
    };
    const { data, diff } = buildEnrichmentUpdate(briefing);
    expect(data.foundedYear).toBeUndefined();
    expect(data.estimatedAnnualRevenue).toBeUndefined();
    expect(data.employeeCountBand).toBeUndefined();
    expect(data.registeredEntityType).toBeUndefined();
    expect(diff.updatedFields).not.toContain("foundedYear");
    expect(diff.skippedFields).toContain("foundedYear");
  });

  it("empty arrays skip (do not blank out existing techStackHints)", () => {
    const briefing: AgentBriefing = {
      ...emptyBriefing,
      techFootprint: { techStackHints: [], publicCertifications: [] },
    };
    const { data } = buildEnrichmentUpdate(briefing);
    expect(data.techStackHints).toBeUndefined();
    expect(data.publicCertifications).toBeUndefined();
  });

  it("empty offices/keyContacts/recentNews arrays skip", () => {
    const briefing: AgentBriefing = {
      ...emptyBriefing,
      offices: [],
      keyContacts: [],
      recentNews: [],
    };
    const { data } = buildEnrichmentUpdate(briefing);
    expect(data.offices).toBeUndefined();
    expect(data.keyContacts).toBeUndefined();
    expect(data.recentNews).toBeUndefined();
  });
});

describe("buildEnrichmentUpdate — overwrite rules (agent's pass is authoritative)", () => {
  it("non-null scalars overwrite", () => {
    const briefing: AgentBriefing = {
      ...emptyBriefing,
      summary: "LAPFCU is a single-branch credit union…",
      fitSignals: ["NCUA compliance signals", "Public-sector affinity"],
      businessProfile: {
        foundedYear: 1936,
        estimatedAnnualRevenue: "$1B+",
        employeeCountBand: "100-250",
        registeredEntityType: "Federal Credit Union",
        charterIdentifiers: { ncuaCharter: "13345", ein: null, fdicCert: null, secCik: null },
      },
    };
    const { data, diff } = buildEnrichmentUpdate(briefing);
    expect(data.researchSummary).toBe("LAPFCU is a single-branch credit union…");
    expect(data.foundedYear).toBe(1936);
    expect(data.estimatedAnnualRevenue).toBe("$1B+");
    expect(data.employeeCountBand).toBe("100-250");
    expect(data.registeredEntityType).toBe("Federal Credit Union");
    // charterIdentifiers should be written as a JSON value (Prisma InputJsonValue)
    expect(data.charterIdentifiers).toBeTruthy();
    expect(diff.updatedFields).toContain("researchSummary");
    expect(diff.updatedFields).toContain("foundedYear");
    expect(diff.updatedFields).toContain("charterIdentifiers");
  });

  it("non-empty array REPLACES wholesale (does not append/merge)", () => {
    const briefing: AgentBriefing = {
      ...emptyBriefing,
      techFootprint: {
        techStackHints: ["Microsoft 365", "Cloudflare"],
        publicCertifications: ["SOC 2"],
      },
    };
    const { data } = buildEnrichmentUpdate(briefing);
    expect(data.techStackHints).toEqual(["Microsoft 365", "Cloudflare"]);
    expect(data.publicCertifications).toEqual(["SOC 2"]);
  });

  it("offices/keyContacts/recentNews filter out empty entries", () => {
    const briefing: AgentBriefing = {
      ...emptyBriefing,
      offices: [
        { address: "1 Hollywood Way", city: "Burbank", state: "CA", zip: "91505" },
        { address: null, city: null, state: null, zip: null }, // empty → filtered
        { label: "HQ", isHQ: true, address: "200 N Loop", city: "Pasadena" },
      ],
      keyContacts: [
        { name: "Jane Doe", title: "CEO", role: "CEO", email: "jd@example.com" },
        { name: "" }, // empty → filtered
      ],
      recentNews: [
        { title: "New branch opens", url: "https://example.com/news/1" },
        { title: "", url: "https://example.com/news/2" }, // empty title → filtered
        { title: "Has no URL", url: "" }, // empty URL → filtered
      ],
    };
    const { data } = buildEnrichmentUpdate(briefing);
    expect(Array.isArray(data.offices)).toBe(true);
    expect((data.offices as unknown[]).length).toBe(2);
    expect(Array.isArray(data.keyContacts)).toBe(true);
    expect((data.keyContacts as unknown[]).length).toBe(1);
    expect(Array.isArray(data.recentNews)).toBe(true);
    expect((data.recentNews as unknown[]).length).toBe(1);
  });

  it("rounds + ignores non-positive foundedYear", () => {
    const briefing: AgentBriefing = {
      ...emptyBriefing,
      businessProfile: { foundedYear: 1987.4 },
    };
    const { data } = buildEnrichmentUpdate(briefing);
    expect(data.foundedYear).toBe(1987);
  });

  it("string-array helper de-empties + trims", () => {
    const briefing: AgentBriefing = {
      ...emptyBriefing,
      fitSignals: ["  signal one  ", "", "  signal two"],
    };
    const { data } = buildEnrichmentUpdate(briefing);
    expect(data.researchFitSignals).toEqual(["signal one", "signal two"]);
  });
});

describe("buildEnrichmentUpdate — opts", () => {
  it("source label is set when provided", () => {
    const { data } = buildEnrichmentUpdate(emptyBriefing, { source: "agent_loop" });
    expect(data.enrichmentSource).toBe("agent_loop");
  });

  it("bumpTimestamps=false skips both timestamps", () => {
    const { data } = buildEnrichmentUpdate(emptyBriefing, { bumpTimestamps: false });
    expect(data.researchCompletedAt).toBeUndefined();
    expect(data.enrichmentCompletedAt).toBeUndefined();
  });
});

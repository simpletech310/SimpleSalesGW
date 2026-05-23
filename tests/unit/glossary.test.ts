import { describe, expect, it } from "vitest";
import {
  GLOSSARY,
  GLOSSARY_CATEGORIES,
  findGlossaryEntry,
  glossaryByCategory,
} from "@/lib/glossary";

describe("glossary registry", () => {
  it("publishes at least 25 terms", () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(25);
  });

  it("every term has a non-empty definition under 280 chars", () => {
    for (const e of GLOSSARY) {
      expect(e.term.length).toBeGreaterThan(0);
      expect(e.definition.length).toBeGreaterThan(0);
      expect(e.definition.length).toBeLessThanOrEqual(280);
    }
  });

  it("terms are unique (case-insensitive)", () => {
    const seen = new Set<string>();
    for (const e of GLOSSARY) {
      const k = e.term.toLowerCase();
      expect(seen.has(k), `duplicate glossary term: ${e.term}`).toBe(false);
      seen.add(k);
    }
  });

  it("every category referenced is in GLOSSARY_CATEGORIES", () => {
    const allowed = new Set<string>(GLOSSARY_CATEGORIES);
    for (const e of GLOSSARY) {
      if (!e.category) continue;
      expect(allowed.has(e.category)).toBe(true);
    }
  });

  it("findGlossaryEntry is case-insensitive", () => {
    expect(findGlossaryEntry("NIST CSF")).toBeDefined();
    expect(findGlossaryEntry("nist csf")).toBeDefined();
    expect(findGlossaryEntry("Nist Csf")).toBeDefined();
    expect(findGlossaryEntry("nonexistent term xyz")).toBeUndefined();
  });

  it("covers all required compliance + tooling + contract terms", () => {
    const required = [
      "NIST CSF", "NIST 800-171", "SPRS", "POAM", "SSP", "CMMC",
      "RMM", "EDR", "MFA",
      "MSA", "SOW", "BAA",
      "vCIO", "QBR",
      "below-floor pricing", "non-strategic deal",
    ];
    for (const term of required) {
      expect(findGlossaryEntry(term), `missing required term: ${term}`).toBeDefined();
    }
  });

  it("glossaryByCategory returns a bucket for every category", () => {
    const grouped = glossaryByCategory();
    for (const cat of GLOSSARY_CATEGORIES) {
      expect(grouped[cat]).toBeDefined();
      expect(Array.isArray(grouped[cat])).toBe(true);
    }
    const total = Object.values(grouped).reduce((s, arr) => s + arr.length, 0);
    expect(total).toBe(GLOSSARY.length);
  });
});

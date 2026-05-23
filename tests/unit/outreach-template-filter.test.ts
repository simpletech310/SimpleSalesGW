import { describe, expect, it } from "vitest";
import { Industry, OutreachCategory } from "@prisma/client";
import { DEFAULT_OUTREACH_TEMPLATES, extractPlaceholders } from "@/lib/outreach/templates";

describe("outreach templates — extractPlaceholders", () => {
  it("extracts unique {{tokens}} in first-seen order", () => {
    const t = "Hi {{first_name}}, {{business_name}}! How are you, {{first_name}}?";
    expect(extractPlaceholders(t)).toEqual(["first_name", "business_name"]);
  });

  it("returns empty array when no placeholders", () => {
    expect(extractPlaceholders("Plain text.")).toEqual([]);
  });

  it("ignores malformed tokens", () => {
    expect(extractPlaceholders("Hi {first_name}, {{}}, {{ok}}")).toEqual(["ok"]);
  });
});

describe("outreach templates — default seed shape", () => {
  it("provides 15 default templates", () => {
    expect(DEFAULT_OUTREACH_TEMPLATES.length).toBe(15);
  });

  it("every default declares a valid category", () => {
    const valid = new Set<string>(Object.values(OutreachCategory));
    for (const t of DEFAULT_OUTREACH_TEMPLATES) {
      expect(valid.has(t.category)).toBe(true);
    }
  });

  it("every default's body has at least one placeholder", () => {
    for (const t of DEFAULT_OUTREACH_TEMPLATES) {
      const fromBody = extractPlaceholders(t.body);
      expect(fromBody.length).toBeGreaterThan(0);
    }
  });

  it("placeholders array on default matches what body declares", () => {
    for (const t of DEFAULT_OUTREACH_TEMPLATES) {
      const extracted = extractPlaceholders(`${t.subject}\n${t.body}`);
      // Defaults may list a superset; assert at least every declared
      // placeholder shows up in the body.
      for (const p of t.placeholders) {
        expect(extracted).toContain(p);
      }
    }
  });

  it("vertical templates carry an industry and a trigger", () => {
    const verticals = DEFAULT_OUTREACH_TEMPLATES.filter((t) => t.industry);
    expect(verticals.length).toBeGreaterThanOrEqual(5);
    for (const v of verticals) {
      expect(v.industry).toBeTruthy();
      expect(v.trigger).toBeTruthy();
    }
  });

  it("at least one trigger-driven template exists for each major lane", () => {
    const triggers = new Set(
      DEFAULT_OUTREACH_TEMPLATES.map((t) => t.trigger).filter((t): t is string => Boolean(t)),
    );
    expect(triggers.has("cold_outreach")).toBe(true);
    expect(triggers.has("voicemail_left")).toBe(true);
    expect(triggers.has("stalled_deal")).toBe(true);
    expect(triggers.has("post_meeting")).toBe(true);
    expect(triggers.has("proposal_silence")).toBe(true);
  });

  it("covers each Industry vertical we shipped scripts for", () => {
    const inds = new Set(DEFAULT_OUTREACH_TEMPLATES.map((t) => t.industry).filter(Boolean));
    expect(inds.has(Industry.MEDICAL)).toBe(true);
    expect(inds.has(Industry.LEGAL)).toBe(true);
    expect(inds.has(Industry.FEDERAL_CONTRACTING)).toBe(true);
    expect(inds.has(Industry.MANUFACTURING)).toBe(true);
    expect(inds.has(Industry.HOSPITALITY)).toBe(true);
  });
});

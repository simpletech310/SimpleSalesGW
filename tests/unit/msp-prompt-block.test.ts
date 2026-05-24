import { describe, expect, it } from "vitest";
import { Industry, ServiceLine } from "@prisma/client";
import { DEFAULT_PROFILE, type MspProfile } from "@/lib/msp/profile";
import { renderMspProfileBlock } from "@/lib/msp/promptBlock";

/**
 * v2.21 — renderMspProfileBlock tests.
 *
 * The renderer's output is what every Claude prompt sees. Verify
 * structure, omissions, and emphasis-label rendering.
 */

describe("renderMspProfileBlock", () => {
  it("includes every required section header for DEFAULT_PROFILE", () => {
    const block = renderMspProfileBlock(DEFAULT_PROFILE);
    expect(block).toContain("## Company:");
    expect(block).toContain("Mission:");
    expect(block).toContain("Voice:");
    expect(block).toContain("Background:");
    expect(block).toContain("Services we sell");
    expect(block).toContain("Target markets:");
    expect(block).toContain("Differentiators");
    expect(block).toContain("Out of scope");
    // No win stories in defaults, so that section must be absent.
    expect(block).not.toContain("Real wins we can cite");
  });

  it("renders companyName + location + tagline in the header", () => {
    const block = renderMspProfileBlock(DEFAULT_PROFILE);
    expect(block).toContain(DEFAULT_PROFILE.companyName);
    expect(block).toContain(DEFAULT_PROFILE.location);
    expect(block).toContain(DEFAULT_PROFILE.tagline);
  });

  it("tags every service with its emphasis in square brackets", () => {
    const block = renderMspProfileBlock(DEFAULT_PROFILE);
    for (const s of DEFAULT_PROFILE.services) {
      const label = s.serviceLine.replace(/_/g, " ");
      expect(block).toContain(`${label} [${s.emphasis}]`);
    }
  });

  it("appends a service note after the emphasis tag when present", () => {
    const block = renderMspProfileBlock(DEFAULT_PROFILE);
    const focusedWithNote = DEFAULT_PROFILE.services.find((s) => s.note);
    expect(focusedWithNote).toBeDefined();
    if (focusedWithNote?.note) {
      expect(block).toContain(`— ${focusedWithNote.note}`);
    }
  });

  it("includes emphasis rules so Claude knows what focus/de-emphasize mean", () => {
    const block = renderMspProfileBlock(DEFAULT_PROFILE);
    expect(block).toContain("Emphasis rules:");
    expect(block).toContain("[focus]");
    expect(block).toContain("[de-emphasize]");
  });

  it("omits empty optional sections cleanly (no 'Differentiators: (none)' noise)", () => {
    const minimal: MspProfile = {
      version: "test",
      companyName: "Acme MSP",
      location: "Anywhere, USA",
      tagline: "",
      missionStatement: "",
      brandVoice: "",
      background: "",
      differentiators: [],
      targetMarkets: [],
      services: [],
      outOfScope: [],
      winStories: [],
    };
    const block = renderMspProfileBlock(minimal);
    expect(block).toContain("Acme MSP");
    expect(block).not.toContain("Mission:");
    expect(block).not.toContain("Voice:");
    expect(block).not.toContain("Background:");
    expect(block).not.toContain("Services we sell");
    expect(block).not.toContain("Target markets:");
    expect(block).not.toContain("Differentiators");
    expect(block).not.toContain("Out of scope");
    expect(block).not.toContain("Real wins we can cite");
  });

  it("renders win stories with industry labels", () => {
    const profile: MspProfile = {
      ...DEFAULT_PROFILE,
      winStories: [
        {
          industry: Industry.MEDICAL,
          situation: "50-seat practice on Comcast",
          outcome: "Migrated to managed IT in 8 weeks",
        },
        {
          industry: "ANY",
          situation: "Any-vertical SMB",
          outcome: "Closed in 60 days",
        },
      ],
    };
    const block = renderMspProfileBlock(profile);
    expect(block).toContain("Real wins we can cite");
    expect(block).toContain("[MEDICAL]");
    expect(block).toContain("[Any industry]");
    expect(block).toContain("50-seat practice on Comcast → Migrated to managed IT in 8 weeks");
  });

  it("output is deterministic across calls (cache-key stability)", () => {
    const a = renderMspProfileBlock(DEFAULT_PROFILE);
    const b = renderMspProfileBlock(DEFAULT_PROFILE);
    expect(a).toBe(b);
  });

  it("changes when any field changes (cache invalidates correctly)", () => {
    const original = renderMspProfileBlock(DEFAULT_PROFILE);
    const tweaked = renderMspProfileBlock({
      ...DEFAULT_PROFILE,
      missionStatement: "Completely different mission",
    });
    expect(original).not.toBe(tweaked);
  });

  it("respects ServiceLine enum naming (no underscores in display)", () => {
    const block = renderMspProfileBlock(DEFAULT_PROFILE);
    // The raw enum has underscores (e.g. MANAGED_IT) — the renderer
    // converts to spaces.
    expect(block).toContain("MANAGED IT");
    expect(block).not.toContain("MANAGED_IT");
    // Sanity: every ServiceLine value renders without an underscore.
    for (const sl of Object.values(ServiceLine)) {
      const label = sl.replace(/_/g, " ");
      expect(block).toContain(label);
    }
  });
});

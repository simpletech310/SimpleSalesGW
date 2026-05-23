import { describe, expect, it } from "vitest";
import { NIST_800_171_QUESTIONS, SP800_171_DEDUCTIONS, SP800_171_FAMILIES } from "@/lib/discovery/nist-800-171-questions";
import { scoreNist800171 } from "@/lib/discovery/scoring/nist-800-171";

describe("NIST 800-171 — 110 controls", () => {
  it("has exactly 110 scoreable controls across 14 families", () => {
    const controls = NIST_800_171_QUESTIONS.filter((q) => q.type === "single_select" && q.id !== "TARGET_LEVEL");
    expect(controls.length).toBe(110);
  });

  it("every control has a deduction value", () => {
    const controls = NIST_800_171_QUESTIONS.filter((q) => q.type === "single_select" && q.id !== "TARGET_LEVEL");
    for (const c of controls) {
      expect(SP800_171_DEDUCTIONS[c.id]).toBeGreaterThanOrEqual(1);
    }
  });

  it("has 14 control families", () => {
    expect(SP800_171_FAMILIES.length).toBe(14);
  });
});

describe("NIST 800-171 SPRS scoring", () => {
  it("all Implemented = SPRS 110", () => {
    const answers: Record<string, unknown> = {};
    for (const q of NIST_800_171_QUESTIONS) {
      if (q.type === "single_select" && q.id !== "TARGET_LEVEL") answers[q.id] = "implemented";
    }
    const r = scoreNist800171(answers);
    expect(r.sprsScore).toBe(110);
    expect(r.poam.length).toBe(0);
  });

  it("all Not-Implemented = SPRS deeply negative (per 800-171A)", () => {
    const answers: Record<string, unknown> = {};
    for (const q of NIST_800_171_QUESTIONS) {
      if (q.type === "single_select" && q.id !== "TARGET_LEVEL") answers[q.id] = "not_implemented";
    }
    const r = scoreNist800171(answers);
    // Sum of all deductions; well below zero
    expect(r.sprsScore).toBeLessThan(0);
    expect(r.poam.length).toBe(110);
  });

  it("partial implementation deducts half the control's deduction", () => {
    const answers: Record<string, unknown> = {};
    // single control partially, rest implemented
    let chosen: string | null = null;
    for (const q of NIST_800_171_QUESTIONS) {
      if (q.type === "single_select" && q.id !== "TARGET_LEVEL") {
        if (!chosen) { chosen = q.id; answers[q.id] = "partially"; }
        else answers[q.id] = "implemented";
      }
    }
    const r = scoreNist800171(answers);
    const deduction = SP800_171_DEDUCTIONS[chosen!]!;
    const half = Math.ceil(deduction / 2);
    expect(r.sprsScore).toBe(110 - half);
    expect(r.poam.length).toBe(1);
  });

  it("Not-Applicable lowers baseline AND score equally — net effect zero", () => {
    const answers: Record<string, unknown> = {};
    let chosen: string | null = null;
    for (const q of NIST_800_171_QUESTIONS) {
      if (q.type === "single_select" && q.id !== "TARGET_LEVEL") {
        if (!chosen) { chosen = q.id; answers[q.id] = "na"; }
        else answers[q.id] = "implemented";
      }
    }
    const r = scoreNist800171(answers);
    const ded = SP800_171_DEDUCTIONS[chosen!]!;
    expect(r.sprsScore).toBe(110 - ded);
    expect(r.sprsBaseline).toBe(110 - ded);
  });

  it("emits an SSP draft narrative per family", () => {
    const r = scoreNist800171({});
    expect(r.ssp.length).toBe(14);
    for (const s of r.ssp) {
      expect(typeof s.narrative).toBe("string");
    }
  });
});

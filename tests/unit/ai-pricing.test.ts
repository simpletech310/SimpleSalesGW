import { describe, expect, it } from "vitest";
import { estimateCallCostUsd, pricingForModel } from "@/lib/ai/pricing";

/**
 * v2.20 — Unit tests for Claude cost estimation. We mock Anthropic in
 * the API-route tests; this file only verifies the math is right.
 */

describe("pricingForModel", () => {
  it("returns Sonnet pricing for the default model", () => {
    const p = pricingForModel("claude-sonnet-4-6");
    expect(p.inputPer1M).toBe(3.0);
    expect(p.outputPer1M).toBe(15.0);
  });

  it("falls back to Sonnet pricing for unknown models", () => {
    const unknown = pricingForModel("claude-sonnet-5-99-fake");
    const sonnet = pricingForModel("claude-sonnet-4-6");
    expect(unknown).toEqual(sonnet);
  });

  it("Haiku is cheaper than Sonnet on every axis", () => {
    const h = pricingForModel("claude-haiku-4");
    const s = pricingForModel("claude-sonnet-4-6");
    expect(h.inputPer1M).toBeLessThan(s.inputPer1M);
    expect(h.outputPer1M).toBeLessThan(s.outputPer1M);
  });

  it("Opus is more expensive than Sonnet on every axis", () => {
    const o = pricingForModel("claude-opus-4-7");
    const s = pricingForModel("claude-sonnet-4-6");
    expect(o.inputPer1M).toBeGreaterThan(s.inputPer1M);
    expect(o.outputPer1M).toBeGreaterThan(s.outputPer1M);
  });
});

describe("estimateCallCostUsd", () => {
  it("computes the basic input + output spend", () => {
    // 1k input * $3/1M = $0.003, 1k output * $15/1M = $0.015 → $0.018
    const cost = estimateCallCostUsd({
      model: "claude-sonnet-4-6",
      inputTokens: 1000,
      outputTokens: 1000,
    });
    expect(cost).toBeCloseTo(0.018, 6);
  });

  it("bills cache reads at 10% of base input", () => {
    const a = estimateCallCostUsd({
      model: "claude-sonnet-4-6",
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 10_000, // $3 * 0.1 / 1M * 10000 = $0.003
    });
    expect(a).toBeCloseTo(0.003, 6);
  });

  it("bills cache creation at 125% of base input", () => {
    const a = estimateCallCostUsd({
      model: "claude-sonnet-4-6",
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 10_000, // $3 * 1.25 / 1M * 10000 = $0.0375
    });
    expect(a).toBeCloseTo(0.0375, 6);
  });

  it("rounds to 6 decimal places", () => {
    // Pick numbers that would land at more than 6dp without rounding
    const cost = estimateCallCostUsd({
      model: "claude-sonnet-4-6",
      inputTokens: 1,
      outputTokens: 1,
    });
    // Should be a clean number, not 0.00000XYZ123...
    const str = String(cost);
    const dec = str.split(".")[1] ?? "";
    expect(dec.length).toBeLessThanOrEqual(6);
  });
});

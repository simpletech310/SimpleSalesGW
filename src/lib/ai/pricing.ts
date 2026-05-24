/**
 * v2.20 — Anthropic per-token pricing constants.
 *
 * Pricing per 1M input/output tokens for the models we support. Cache
 * reads bill at 10% of base input; cache creation bills at 125% of base
 * input. Numbers should be updated if Anthropic changes published pricing.
 *
 * Source: https://www.anthropic.com/pricing
 */

export type ModelPricing = {
  inputPer1M: number;          // USD per 1M base input tokens
  outputPer1M: number;         // USD per 1M output tokens
  cacheReadPer1M: number;      // USD per 1M cache-hit input tokens
  cacheCreationPer1M: number;  // USD per 1M cache-creation input tokens
};

/**
 * Defaults match Anthropic's published Sonnet pricing as of 2026-05. If
 * we move to a different model (Opus, Haiku), add an entry here and the
 * cost estimator will pick it up via `pricingForModel()`.
 */
const PRICING: Record<string, ModelPricing> = {
  // Sonnet family — current default
  "claude-sonnet-4-6":   { inputPer1M: 3.00, outputPer1M: 15.00, cacheReadPer1M: 0.30, cacheCreationPer1M: 3.75 },
  "claude-sonnet-4-5":   { inputPer1M: 3.00, outputPer1M: 15.00, cacheReadPer1M: 0.30, cacheCreationPer1M: 3.75 },
  // Haiku — cheap fallback
  "claude-haiku-4":      { inputPer1M: 0.80, outputPer1M:  4.00, cacheReadPer1M: 0.08, cacheCreationPer1M: 1.00 },
  // Opus — expensive flagship
  "claude-opus-4-7":     { inputPer1M: 15.0, outputPer1M: 75.00, cacheReadPer1M: 1.50, cacheCreationPer1M: 18.75 },
};

/** Fallback for unknown models — uses Sonnet pricing so cost estimates
 *  are conservative rather than artificially low. */
const FALLBACK: ModelPricing = PRICING["claude-sonnet-4-6"]!;

export function pricingForModel(model: string): ModelPricing {
  return PRICING[model] ?? FALLBACK;
}

/**
 * Estimate the USD cost of a single Claude call given its token counts.
 *
 * `inputTokens` from the Anthropic SDK already excludes cache-read and
 * cache-creation tokens — they're billed separately. Add all three
 * line items together for the call's true cost.
 */
export function estimateCallCostUsd(opts: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}): number {
  const p = pricingForModel(opts.model);
  const base = (opts.inputTokens * p.inputPer1M) / 1_000_000;
  const out  = (opts.outputTokens * p.outputPer1M) / 1_000_000;
  const read = ((opts.cacheReadInputTokens ?? 0) * p.cacheReadPer1M) / 1_000_000;
  const ccre = ((opts.cacheCreationInputTokens ?? 0) * p.cacheCreationPer1M) / 1_000_000;
  return Math.round((base + out + read + ccre) * 1_000_000) / 1_000_000; // 6dp
}

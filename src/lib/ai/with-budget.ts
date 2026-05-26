/**
 * v3.3 — Shared wrapper for the SOP-alignment AI assistants.
 *
 * Provides a single helper that:
 *   1. Short-circuits to a graceful fallback when ANTHROPIC_API_KEY is
 *      missing (UI shows "AI unavailable, fill manually").
 *   2. Wraps `claudeCompletion` (which already enforces budget caps and
 *      writes AiUsageLog) and translates AiBudgetExceededError into a
 *      typed `{ ok: false, reason }` result so callers don't have to try/catch.
 *   3. Parses the model's response as JSON, validates it with a Zod
 *      schema, and returns the parsed value alongside raw text for audit.
 *
 * Pattern every assistant follows:
 *   const result = await withBudgetedJson({
 *     system, user, schema, feature, budget, maxTokens
 *   });
 *   if (!result.ok) return graceful-fallback;
 *   return result.value;
 */

import type { z } from "zod";
import { AiFeatureKind } from "@prisma/client";
import {
  claudeCompletion,
  isAnthropicConfigured,
  AnthropicNotConfiguredError,
} from "@/lib/ai/anthropic";
import { AiBudgetExceededError } from "@/lib/ai/budget";
import { loadProfile } from "@/lib/msp/loader";
import { renderMspProfileBlock } from "@/lib/msp/promptBlock";

export type BudgetedJsonInput<S extends z.ZodTypeAny> = {
  /** Task-specific instructions appended after the MSP profile preamble. */
  systemTask: string;
  /** Per-call user message. */
  user: string;
  /** Zod schema the response must satisfy. */
  schema: S;
  /** Which AI feature this is — drives budget bucketing + AiUsageLog. */
  feature: AiFeatureKind;
  /** Budget context. Provide leadId whenever the call relates to a lead. */
  budget?: { leadId?: string; userId?: string };
  /** Token cap (default 1200). */
  maxTokens?: number;
};

export type BudgetedJsonResult<T> =
  | { ok: true; value: T; raw: string }
  | { ok: false; reason: "not-configured" | "budget-exceeded" | "parse-failed"; detail: string };

/**
 * Assemble system prompt = MSP profile preamble + task-specific instructions,
 * call Claude, JSON-parse the response, Zod-validate. Returns a discriminated
 * union so callers can render a graceful fallback without try/catch.
 */
export async function withBudgetedJson<S extends z.ZodTypeAny>(
  input: BudgetedJsonInput<S>,
): Promise<BudgetedJsonResult<z.infer<S>>> {
  if (!isAnthropicConfigured()) {
    return { ok: false, reason: "not-configured", detail: "ANTHROPIC_API_KEY not set" };
  }

  const profile = await loadProfile();
  const system = `${renderMspProfileBlock(profile)}\n\n${input.systemTask}`;

  try {
    const { text } = await claudeCompletion({
      system,
      user: input.user,
      responseHint: "Return ONLY the JSON object — no markdown fences, no commentary.",
      maxTokens: input.maxTokens ?? 1200,
      budget: input.budget
        ? { leadId: input.budget.leadId, userId: input.budget.userId, feature: input.feature }
        : undefined,
    });

    const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(cleaned);
    } catch {
      return { ok: false, reason: "parse-failed", detail: `Could not parse JSON: ${cleaned.slice(0, 200)}` };
    }

    const parsed = input.schema.safeParse(parsedJson);
    if (!parsed.success) {
      return { ok: false, reason: "parse-failed", detail: parsed.error.message };
    }

    return { ok: true, value: parsed.data, raw: text };
  } catch (err) {
    if (err instanceof AiBudgetExceededError) {
      return { ok: false, reason: "budget-exceeded", detail: err.message };
    }
    if (err instanceof AnthropicNotConfiguredError) {
      return { ok: false, reason: "not-configured", detail: err.message };
    }
    // Re-throw genuine failures so the caller's error handler can log them
    throw err;
  }
}

/**
 * Human-friendly fallback messages keyed off the failure reason.
 * Used by route handlers to populate the UI advisory block.
 */
export function fallbackMessage(reason: BudgetedJsonResult<unknown> extends { ok: false; reason: infer R } ? R : never): string {
  switch (reason) {
    case "not-configured":
      return "AI assistance is not configured for this environment. Fill the form manually.";
    case "budget-exceeded":
      return "AI budget exhausted for this lead or month. Fill the form manually, or ask a Superadmin to raise the cap.";
    case "parse-failed":
      return "AI returned an unexpected response. Fill the form manually.";
    default:
      return "AI unavailable. Fill the form manually.";
  }
}

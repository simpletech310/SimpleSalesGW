/**
 * Thin wrapper around @anthropic-ai/sdk with prompt caching baked in.
 * The system block is cache-controlled so repeat calls for the same Lead
 * pay only the read price.
 *
 * v2.20 — adds optional budget context: pass `budget: { leadId, userId,
 * feature }` and the call (1) checks per-lead + org budget before firing,
 * (2) records an AiUsageLog row after success. Backward-compatible: omit
 * `budget` and the wrapper behaves exactly as v1.1.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AiFeatureKind } from "@prisma/client";
import { env } from "@/lib/env";
import { checkBudget, recordUsage } from "./budget";

let client: Anthropic | null = null;

export function isAnthropicConfigured(): boolean {
  return Boolean(env().ANTHROPIC_API_KEY);
}

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = env().ANTHROPIC_API_KEY;
  if (!apiKey) throw new AnthropicNotConfiguredError();
  client = new Anthropic({ apiKey });
  return client;
}

export class AnthropicNotConfiguredError extends Error {
  // v3.3.12 — user-visible message is whitelabeled to "Gateway AI". Admins
  // still see the underlying env var name on /admin/setup.
  constructor() { super("Gateway AI is not configured. Ask your administrator to set the API key."); this.name = "AnthropicNotConfiguredError"; }
}

export type ClaudeCompletionInput = {
  system: string;
  user: string;
  /** Optional JSON schema-like description appended to the user message asking for structured output. */
  responseHint?: string;
  /** Token cap; default 1500. */
  maxTokens?: number;
  /** v2.20 — budget enforcement + usage logging context. Omit for unbilled / ad-hoc calls. */
  budget?: {
    leadId?: string;
    userId?: string;
    feature: AiFeatureKind;
  };
};

export type ClaudeUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
};

export async function claudeCompletion(input: ClaudeCompletionInput): Promise<{ text: string; usage: ClaudeUsage }> {
  // v2.20 — budget gate fires before we spend a token. Throws
  // AiBudgetExceededError (status 429) which feature routes translate
  // into a clean response with remaining-budget detail.
  if (input.budget) {
    await checkBudget({ leadId: input.budget.leadId });
  }

  const c = getClient();
  const model = env().ANTHROPIC_MODEL;
  const userText = input.responseHint ? `${input.user}\n\n${input.responseHint}` : input.user;
  const response = await c.messages.create({
    model,
    max_tokens: input.maxTokens ?? 1500,
    system: [
      {
        type: "text",
        text: input.system,
        // @ts-expect-error — cache_control is supported via beta header; SDK types lag.
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userText }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const usage = response.usage as Anthropic.Usage & {
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };

  const usageOut: ClaudeUsage = {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadInputTokens: usage.cache_read_input_tokens,
    cacheCreationInputTokens: usage.cache_creation_input_tokens,
  };

  // v2.20 — record usage AFTER successful completion. We deliberately
  // wrap in try/catch + log: a failure to write the usage row should
  // never fail an already-successful user call. The budget gate above
  // is the load-bearing safety; this is observability + roll-up.
  if (input.budget) {
    try {
      await recordUsage({
        leadId: input.budget.leadId,
        userId: input.budget.userId,
        feature: input.budget.feature,
        model,
        inputTokens: usageOut.inputTokens,
        outputTokens: usageOut.outputTokens,
        cacheReadInputTokens: usageOut.cacheReadInputTokens,
        cacheCreationInputTokens: usageOut.cacheCreationInputTokens,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[ai] recordUsage failed (call still succeeded):", err);
    }
  }

  return { text, usage: usageOut };
}

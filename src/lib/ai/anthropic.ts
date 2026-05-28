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

// ===========================================================================
// v3.3.28 — Tool-use loop for the agentic research pipeline.
// ===========================================================================

/** One Anthropic tool definition. Mirrors the SDK's `Tool` type but kept
 *  loose so callers don't have to import SDK types just to declare tools. */
export type ClaudeToolSpec = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

/** Result of a single tool execution. The loop turns this back into a
 *  `tool_result` content block on the next user turn. */
export type ClaudeToolResult = {
  tool_use_id: string;
  /** Stringified content the model will see as the tool's output. */
  content: string;
  /** If true, the SDK marks the tool_result as `is_error: true`. */
  isError?: boolean;
};

/** A tool-call the model produced. Caller's handler decides what to do. */
export type ClaudeToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type ClaudeToolLoopInput = {
  system: string;
  /** Initial user message. Subsequent turns are managed by the loop. */
  user: string;
  tools: ClaudeToolSpec[];
  /** Async handler — receives one tool call, returns one tool result.
   *  Throw inside the handler ONLY for unrecoverable errors; otherwise
   *  return `{isError: true, content: "..."}` so the model can adapt. */
  onToolCall: (call: ClaudeToolCall) => Promise<ClaudeToolResult>;
  /** Bound the loop. Default 7. Hard ceiling 12 to protect cost. */
  maxRounds?: number;
  /** Token cap per assistant turn. Default 2500. */
  maxTokensPerTurn?: number;
  /** v2.20-style budget context — gated once at the top of the loop and
   *  recordUsage'd after each turn. */
  budget?: {
    leadId?: string;
    userId?: string;
    feature: AiFeatureKind;
  };
};

export type ClaudeToolLoopOutput = {
  /** Final assistant text after the model stopped calling tools. May be
   *  empty if the model exhausted maxRounds without producing text. */
  text: string;
  /** Per-round usage summed across the loop. */
  totalUsage: ClaudeUsage;
  /** Number of tool-calling rounds executed (capped by maxRounds). */
  rounds: number;
  /** Reason the loop stopped: "end_turn" | "max_rounds" | "stop_sequence" | "max_tokens" | "error". */
  stopReason: string;
};

/**
 * Drive a Claude tool-use conversation to completion.
 *
 * - System prompt + tool definitions are cache-controlled so successive
 *   calls (per-lead, per-feature) pay the read price, not full input.
 * - Each round: send messages → if assistant uses tools, invoke handler
 *   per tool_use block, append tool_result blocks, repeat. Loop ends on
 *   `stop_reason === "end_turn"` or after `maxRounds`.
 * - Errors thrown by the handler bubble up; soft failures (e.g. provider
 *   returned http_500) should be surfaced via `{isError: true}` so the
 *   model can route around them.
 */
export async function claudeToolLoop(input: ClaudeToolLoopInput): Promise<ClaudeToolLoopOutput> {
  if (input.budget) {
    await checkBudget({ leadId: input.budget.leadId });
  }

  const c = getClient();
  const model = env().ANTHROPIC_MODEL;
  const maxRounds = Math.max(1, Math.min(12, input.maxRounds ?? 7));
  const maxTokens = input.maxTokensPerTurn ?? 2500;

  // We mutate this list each round, appending the assistant's content +
  // a synthetic user turn carrying tool_result blocks.
  const messages: Array<{
    role: "user" | "assistant";
    content: string | Array<Record<string, unknown>>;
  }> = [{ role: "user", content: input.user }];

  const totalUsage: ClaudeUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
  };
  let finalText = "";
  let rounds = 0;
  let stopReason = "error";

  for (let round = 0; round < maxRounds; round++) {
    rounds = round + 1;
    const response = await c.messages.create({
      model,
      max_tokens: maxTokens,
      system: [
        {
          type: "text",
          text: input.system,
          // @ts-expect-error — cache_control via beta header; SDK types lag.
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: input.tools as never,
      messages: messages as never,
    });

    const usage = response.usage as Anthropic.Usage & {
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
    totalUsage.inputTokens += usage.input_tokens;
    totalUsage.outputTokens += usage.output_tokens;
    totalUsage.cacheReadInputTokens =
      (totalUsage.cacheReadInputTokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
    totalUsage.cacheCreationInputTokens =
      (totalUsage.cacheCreationInputTokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);

    // Record per-turn usage so per-lead budget caps are honored mid-loop.
    if (input.budget) {
      try {
        await recordUsage({
          leadId: input.budget.leadId,
          userId: input.budget.userId,
          feature: input.budget.feature,
          model,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          cacheReadInputTokens: usage.cache_read_input_tokens,
          cacheCreationInputTokens: usage.cache_creation_input_tokens,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[ai] tool-loop recordUsage failed:", err);
      }
    }

    stopReason = (response.stop_reason as string) ?? "error";

    // Collect any text the model emitted this turn.
    const turnText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    if (turnText) finalText = turnText;

    // Find tool_use blocks. If none, the model is done.
    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (toolUses.length === 0 || stopReason === "end_turn") {
      break;
    }

    // Append the assistant's full content (text + tool_use blocks) verbatim
    // — required for the conversation to make sense to the next turn.
    messages.push({
      role: "assistant",
      content: response.content as never,
    });

    // Execute each tool_use, collecting tool_result blocks.
    const toolResults: Array<Record<string, unknown>> = [];
    for (const tu of toolUses) {
      let result: ClaudeToolResult;
      try {
        result = await input.onToolCall({
          id: tu.id,
          name: tu.name,
          input: (tu.input as Record<string, unknown>) ?? {},
        });
      } catch (err) {
        result = {
          tool_use_id: tu.id,
          content: `Tool handler threw: ${(err as Error).message}`,
          isError: true,
        };
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: result.tool_use_id,
        content: result.content,
        ...(result.isError ? { is_error: true } : {}),
      });
    }

    messages.push({ role: "user", content: toolResults });

    // Safety: if Claude tries to keep going past maxRounds, bail.
    if (round === maxRounds - 1) {
      stopReason = "max_rounds";
    }
  }

  return { text: finalText, totalUsage, rounds, stopReason };
}

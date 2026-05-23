/**
 * Thin wrapper around @anthropic-ai/sdk with prompt caching baked in.
 * The system block is cache-controlled so repeat calls for the same Lead
 * pay only the read price.
 */

import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

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
  constructor() { super("ANTHROPIC_API_KEY not configured"); this.name = "AnthropicNotConfiguredError"; }
}

export type ClaudeCompletionInput = {
  system: string;
  user: string;
  /** Optional JSON schema-like description appended to the user message asking for structured output. */
  responseHint?: string;
  /** Token cap; default 1500. */
  maxTokens?: number;
};

export async function claudeCompletion(input: ClaudeCompletionInput): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; cacheReadInputTokens?: number; cacheCreationInputTokens?: number } }> {
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

  return {
    text,
    usage: {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadInputTokens: usage.cache_read_input_tokens,
      cacheCreationInputTokens: usage.cache_creation_input_tokens,
    },
  };
}

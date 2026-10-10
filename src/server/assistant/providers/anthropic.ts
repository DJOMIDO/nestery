// src/server/assistant/providers/anthropic.ts
// Claude through the official Anthropic SDK.

import Anthropic from "@anthropic-ai/sdk";
import { ProviderError, type ChatProvider, type ProviderTurn } from "./types";

type MessageParam = Anthropic.Beta.BetaMessageParam;

// Models that accept server-side fallbacks: when the model's safety systems
// decline a request, the API retries it on a suitable model in the same call
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

// Retries when a streamed tool input could not be parsed at all
const MAX_JSON_RETRIES = 2;

const client = (apiKey: string) => new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });

// Plain messages for the errors a user can fix
function describeError(err: unknown): ProviderError {
  if (err instanceof Anthropic.AuthenticationError) {
    return new ProviderError("Anthropic rejected the API key. Check it in Settings > Assistant.", 400);
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new ProviderError("This API key may not use that model.", 400);
  }
  if (err instanceof Anthropic.NotFoundError) {
    return new ProviderError("Anthropic does not know that model. Choose another in Settings > Assistant.", 400);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new ProviderError("Anthropic's rate limit was reached. Try again in a minute.", 429);
  }
  if (err instanceof Anthropic.BadRequestError) {
    // Includes running out of credit
    return new ProviderError(`Anthropic refused the request: ${err.message}`, 400);
  }
  if (err instanceof Anthropic.APIError) {
    return new ProviderError("Anthropic is unavailable right now. Try again later.");
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new ProviderError("Could not reach Anthropic. Try again later.");
  }
  return new ProviderError("The assistant failed unexpectedly.");
}

export function anthropicProvider({ apiKey, model }: { apiKey: string; model: string }): ChatProvider {
  const anthropic = client(apiKey);
  const fallbacks = FALLBACK_MODELS.has(model)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};

  return {
    userMessage: (text): MessageParam => ({ role: "user", content: [{ type: "text", text }] }),

    toolResultsMessage: (results): MessageParam => ({
      role: "user",
      content: results.map((r) => ({
        type: "tool_result",
        tool_use_id: r.id,
        content: r.content,
        ...(r.isError && { is_error: true }),
      })),
    }),

    isHistory: (history) =>
      history.every(
        (m) =>
          typeof m === "object" &&
          m !== null &&
          ((m as MessageParam).role === "user" || (m as MessageParam).role === "assistant") &&
          Array.isArray((m as MessageParam).content)
      ),

    async step({ system, tools, messages, onText, signal }): Promise<ProviderTurn> {
      for (let attempt = 0; ; attempt++) {
        let streamedText = false;
        try {
          const stream = anthropic.beta.messages.stream(
            {
              model,
              max_tokens: 16000,
              // Caches the tools, system prompt and conversation for the next call
              cache_control: { type: "ephemeral" },
              system,
              tools: tools.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: t.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
                // Stream tool inputs as generated; the loop validates them
                eager_input_streaming: true,
              })),
              messages: messages as MessageParam[],
              ...fallbacks,
            },
            { signal }
          );
          stream.on("text", (text) => {
            streamedText = true;
            onText(text);
          });
          const message = await stream.finalMessage();

          const toolCalls = message.content
            .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use")
            .map((b) => ({ id: b.id, name: b.name, input: b.input }));
          const reply: MessageParam = { role: "assistant", content: message.content };

          if (message.stop_reason === "refusal") return { message: reply, toolCalls: [], stop: "refused" };
          if (message.stop_reason === "max_tokens" && toolCalls.length > 0) {
            return { message: reply, toolCalls: [], stop: "truncated" };
          }
          return { message: reply, toolCalls, stop: toolCalls.length > 0 ? "tool_calls" : "done" };
        } catch (err) {
          if (signal?.aborted) throw err;
          // A tool input that could not be parsed: ask again, unless text
          // already reached the user (it would be shown twice)
          const parseFailure = !(err instanceof Anthropic.APIError) && !(err instanceof Anthropic.APIConnectionError);
          if (parseFailure && !streamedText && attempt < MAX_JSON_RETRIES) continue;
          throw describeError(err);
        }
      }
    },
  };
}

// Model ids the key can use, newest first. Also checks that the key works.
export async function listAnthropicModels(apiKey: string) {
  try {
    const ids: string[] = [];
    for await (const model of client(apiKey).models.list({ limit: 100 })) ids.push(model.id);
    return ids;
  } catch (err) {
    throw describeError(err);
  }
}

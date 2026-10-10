// src/server/assistant/providers/openai.ts
// Any provider speaking the OpenAI chat completions API: OpenAI itself,
// Gemini, OpenRouter, DeepSeek, or a local server such as LM Studio.
//
// The base URL can be the user's own, and the server makes the request, so
// it is checked like a calendar feed URL: public hosts only, no redirects.
// While developing, local servers are allowed.

import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { assertPublicHost, FeedError } from "@/server/fetchIcs";
import { stripThinking, thinkingFilter } from "./thinking";
import { ProviderError, type ChatProvider, type ProviderTurn } from "./types";

type Message = OpenAI.Chat.ChatCompletionMessageParam;

const allowPrivateHosts = process.env.NODE_ENV !== "production";

async function checkHost(baseUrl: string) {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new ProviderError("The base URL is not a valid link.", 400);
  }
  if (url.protocol !== "https:" && !(allowPrivateHosts && url.protocol === "http:")) {
    throw new ProviderError("The base URL must start with https://", 400);
  }
  if (allowPrivateHosts) return;
  try {
    await assertPublicHost(url);
  } catch (err) {
    if (err instanceof FeedError) throw new ProviderError(`${url.host}: ${err.message}.`, 400);
    throw err;
  }
}

// Checked again on every request, so a host that changes its address can't
// slip through; redirects are refused for the same reason
const guardedFetch = async (input: string | URL | Request, init?: RequestInit) => {
  if (!allowPrivateHosts) await assertPublicHost(new URL(input instanceof Request ? input.url : input));
  return fetch(input, { ...init, redirect: "error" });
};

const client = (apiKey: string | null, baseUrl: string) =>
  new OpenAI({
    // Local servers usually don't need a key, but the SDK wants one
    apiKey: apiKey || "none",
    baseURL: baseUrl,
    fetch: guardedFetch,
    maxRetries: 2,
    timeout: 120_000,
  });

function describeError(err: unknown, baseUrl: string): ProviderError {
  if (err instanceof ProviderError) return err;
  const host = new URL(baseUrl).host;
  if (err instanceof OpenAI.AuthenticationError || err instanceof OpenAI.PermissionDeniedError) {
    return new ProviderError(`${host} rejected the API key. Check it in Settings > Assistant.`, 400);
  }
  if (err instanceof OpenAI.NotFoundError) {
    return new ProviderError(`${host} doesn't know that model, or the base URL is wrong.`, 400);
  }
  if (err instanceof OpenAI.RateLimitError) {
    return new ProviderError(`${host}'s rate limit or quota was reached. Try again later.`, 429);
  }
  if (err instanceof OpenAI.BadRequestError) {
    return new ProviderError(`${host} refused the request: ${err.message}`, 400);
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return new ProviderError(`Could not reach ${host}.`);
  }
  if (err instanceof OpenAI.APIError) {
    return new ProviderError(`${host} is unavailable right now. Try again later.`);
  }
  return new ProviderError("The assistant failed unexpectedly.");
}

// Arguments arrive as a JSON string; unparseable ones are passed on so the
// loop's validation reports them to the model, which can try again
function parseArguments(args: string) {
  try {
    return JSON.parse(args || "{}");
  } catch {
    return { unparseableArguments: args };
  }
}

export function openaiProvider({
  apiKey,
  model,
  baseUrl,
}: {
  apiKey: string | null;
  model: string;
  baseUrl: string;
}): ChatProvider {
  const openai = client(apiKey, baseUrl);

  return {
    userMessage: (text): Message => ({ role: "user", content: text }),

    // One message per result, as the API expects
    toolResults: (results): Message[] =>
      results.map((r) => ({
        role: "tool",
        tool_call_id: r.id,
        content: r.isError ? `Error: ${r.content}` : r.content,
      })),

    isHistory: (history) =>
      history.every(
        (m) =>
          typeof m === "object" &&
          m !== null &&
          ["user", "assistant", "tool"].includes((m as Message).role) &&
          // This adapter always writes text content, which tells its messages
          // apart from Anthropic's (content blocks)
          ((m as Message).content === null || typeof (m as Message).content === "string")
      ),

    async step({ system, tools, messages, onText, signal }): Promise<ProviderTurn> {
      try {
        await checkHost(baseUrl);
        const stream = openai.chat.completions.stream(
          {
            model,
            messages: [{ role: "system", content: system }, ...(messages as Message[])],
            tools: tools.map((t) => ({
              type: "function",
              function: { name: t.name, description: t.description, parameters: t.inputSchema },
            })),
          },
          { signal }
        );
        // Reasoning written into the reply as <think>…</think> stays hidden
        const visible = thinkingFilter();
        stream.on("content.delta", ({ delta }) => {
          const text = visible(delta);
          if (text) onText(text);
        });
        const completion = await stream.finalChatCompletion();
        const rest = visible("", true);
        if (rest) onText(rest);
        const choice = completion.choices[0];
        if (!choice) throw new ProviderError("The model returned no answer.");

        // Some providers leave ids empty; the tool results must match them
        const calls = (choice.message.tool_calls ?? [])
          .filter((c) => c.type === "function")
          .map((c) => ({ id: c.id || `call_${randomUUID()}`, name: c.function.name, arguments: c.function.arguments }));
        const reply: Message = {
          role: "assistant",
          content: choice.message.content ? stripThinking(choice.message.content) : null,
          ...(calls.length > 0 && {
            tool_calls: calls.map((c) => ({
              id: c.id,
              type: "function" as const,
              function: { name: c.name, arguments: c.arguments },
            })),
          }),
        };
        const toolCalls = calls.map((c) => ({ id: c.id, name: c.name, input: parseArguments(c.arguments) }));

        if (choice.finish_reason === "content_filter") return { message: reply, toolCalls: [], stop: "refused" };
        if (choice.finish_reason === "length" && toolCalls.length > 0) {
          return { message: reply, toolCalls: [], stop: "truncated" };
        }
        return { message: reply, toolCalls, stop: toolCalls.length > 0 ? "tool_calls" : "done" };
      } catch (err) {
        if (signal?.aborted) throw err;
        throw describeError(err, baseUrl);
      }
    },
  };
}

// Model ids the key can use. Also checks that the key and URL work.
export async function listOpenAIModels(apiKey: string | null, baseUrl: string) {
  try {
    await checkHost(baseUrl);
    const ids: string[] = [];
    for await (const model of client(apiKey, baseUrl).models.list()) {
      // Gemini lists "models/gemini-…" but takes the bare name
      ids.push(model.id.replace(/^models\//, ""));
    }
    return ids.sort();
  } catch (err) {
    throw describeError(err, baseUrl);
  }
}

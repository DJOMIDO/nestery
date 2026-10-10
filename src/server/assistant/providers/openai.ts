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

const KNOWN_CALL_FIELDS = new Set(["index", "id", "type", "function"]);

interface StreamedCall {
  id: string;
  name: string;
  arguments: string;
  extra: Record<string, unknown>;
}

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
  // Kept in the logs: these are the ones to look into
  console.error(`Assistant provider ${host} failed`, err);
  return new ProviderError(`Unexpected error from ${host}: ${err instanceof Error ? err.message : String(err)}`);
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
    userMessage: (text, images = []): Message =>
      images.length
        ? {
            role: "user",
            content: [
              { type: "text", text },
              ...images.map((image) => ({
                type: "image_url" as const,
                image_url: { url: `data:${image.mediaType};base64,${image.data}` },
              })),
            ],
          }
        : { role: "user", content: text },

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
          // This adapter writes text content, or text and image_url parts for a
          // message with images; Anthropic's blocks look different
          ((m as Message).content === null ||
            typeof (m as Message).content === "string" ||
            (Array.isArray((m as Message).content) &&
              ((m as Message).content as { type?: string }[]).every(
                (part) => part.type === "text" || part.type === "image_url"
              )))
      ),

    async step({ system, tools, messages, onText, signal }): Promise<ProviderTurn> {
      try {
        await checkHost(baseUrl);
        // Streamed by hand rather than with the SDK's stream helper, which
        // rejects small differences between providers (e.g. a tool call chunk
        // without `type`, as Gemini sends)
        const stream = await openai.chat.completions.create(
          {
            model,
            stream: true,
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
        let content = "";
        let finishReason: string | null = null;
        const pending = new Map<string, StreamedCall>();
        let lastKey = "";
        for await (const chunk of stream) {
          const choice = chunk.choices?.[0];
          if (!choice) continue;
          if (choice.delta?.content) {
            content += choice.delta.content;
            const text = visible(choice.delta.content);
            if (text) onText(text);
          }
          for (const delta of choice.delta?.tool_calls ?? []) {
            // Calls are told apart by index; some providers only send an id
            const key = delta.index !== undefined ? `i${delta.index}` : delta.id ? `id${delta.id}` : lastKey || "i0";
            lastKey = key;
            const call = pending.get(key) ?? { id: "", name: "", arguments: "", extra: {} };
            if (delta.id) call.id = delta.id;
            if (delta.function?.name && !call.name) call.name = delta.function.name;
            if (delta.function?.arguments) call.arguments += delta.function.arguments;
            // Anything else (e.g. Gemini's thought signature) is sent back as is
            for (const [key, value] of Object.entries(delta)) {
              if (!KNOWN_CALL_FIELDS.has(key)) call.extra[key] = value;
            }
            pending.set(key, call);
          }
          if (choice.finish_reason) finishReason = choice.finish_reason;
        }
        const rest = visible("", true);
        if (rest) onText(rest);

        // Some providers leave ids empty; the tool results must match them
        const calls = [...pending.values()]
          .filter((c) => c.name)
          .map((c) => ({ ...c, id: c.id || `call_${randomUUID()}` }));
        const reply: Message = {
          role: "assistant",
          content: content ? stripThinking(content) : null,
          ...(calls.length > 0 && {
            tool_calls: calls.map((c) => ({
              ...c.extra,
              id: c.id,
              type: "function" as const,
              function: { name: c.name, arguments: c.arguments },
            })),
          }),
        };
        const toolCalls = calls.map((c) => ({ id: c.id, name: c.name, input: parseArguments(c.arguments) }));

        if (finishReason === "content_filter") return { message: reply, toolCalls: [], stop: "refused" };
        if (finishReason === "length" && toolCalls.length > 0) {
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

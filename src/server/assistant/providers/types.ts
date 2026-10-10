// src/server/assistant/providers/types.ts
// What the agent loop needs from a model provider. Each provider keeps the
// conversation in its own message format ("native" messages): the loop only
// appends them, never edits them, so provider features that depend on an
// unchanged history (prompt caching, reasoning carried between turns) work.

import type { AssistantImage } from "@/lib/assistant";

// A tool as offered to the model, with a JSON Schema for its input
export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  // Unvalidated: the loop checks it against the tool's schema
  input: unknown;
}

export interface ToolResult {
  id: string;
  content: string;
  isError?: boolean;
}

export interface ProviderTurn {
  // The model's reply, to append to the conversation as is
  message: unknown;
  toolCalls: ToolCall[];
  // "refused": declined by the provider's safety systems; "truncated": the
  // reply hit the output limit in the middle of a tool call
  stop: "done" | "tool_calls" | "refused" | "truncated";
}

export interface ChatProvider {
  userMessage(text: string, images?: AssistantImage[]): unknown;
  // Messages answering one turn's tool calls
  toolResults(results: ToolResult[]): unknown[];
  // Rejects history that cannot have come from this provider
  isHistory(history: unknown[]): boolean;
  // One model call over the conversation so far; text is streamed to onText
  step(args: {
    system: string;
    tools: ToolSpec[];
    messages: unknown[];
    onText: (text: string) => void;
    signal?: AbortSignal;
  }): Promise<ProviderTurn>;
}

// A failure worth showing to the user as is (bad key, unknown model, ...)
export class ProviderError extends Error {
  constructor(
    message: string,
    public status = 502
  ) {
    super(message);
  }
}

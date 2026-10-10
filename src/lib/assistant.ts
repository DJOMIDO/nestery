// src/lib/assistant.ts
// Assistant types shared by the server, the chat panel and Settings. Keep this
// file free of server-only imports.

import type { TaskPriority, TaskStatus } from "@/lib/tasks";

// Model providers a user can bring their own API key for. All but Anthropic
// are reached through the OpenAI-compatible chat API.
export const ASSISTANT_PROVIDERS = ["anthropic", "openai", "gemini", "openrouter", "custom"] as const;

export type AssistantProvider = (typeof ASSISTANT_PROVIDERS)[number];

export const ASSISTANT_PROVIDER_LABELS: Record<AssistantProvider, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
  gemini: "Google Gemini",
  openrouter: "OpenRouter",
  custom: "Other (OpenAI-compatible)",
};

// Where each OpenAI-compatible provider is reached; "custom" takes the user's URL
export const PROVIDER_BASE_URLS: Partial<Record<AssistantProvider, string>> = {
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  openrouter: "https://openrouter.ai/api/v1",
};

// Where users create a key
export const PROVIDER_KEY_PAGES: Partial<Record<AssistantProvider, string>> = {
  anthropic: "https://platform.claude.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
  gemini: "https://aistudio.google.com/apikey",
  openrouter: "https://openrouter.ai/keys",
};

// Offered first in Settings when the provider lists them; any listed model
// can be chosen
export const SUGGESTED_MODELS: Record<AssistantProvider, string[]> = {
  anthropic: ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"],
  openai: [],
  gemini: [],
  openrouter: [],
  custom: [],
};

// Settings > Assistant as the browser sees it: never the key itself
export interface AssistantSettingsView {
  provider: AssistantProvider;
  model: string;
  // "custom" only
  baseUrl: string | null;
  // e.g. "…a1b2"; null when no key is saved
  apiKeyHint: string | null;
}

// Whether the chat panel can be used, and with whose key
export interface AssistantStatus {
  available: boolean;
  // "own": the user's key; "server": the app owner's key (allow-listed users)
  source: "own" | "server" | null;
  model: string | null;
  // Saving keys needs ASSISTANT_ENCRYPTION_KEY on the server
  canSaveKey: boolean;
  dailyLimit: number;
  usedToday: number;
}

// A change the assistant wants to make. Nothing is written until the user
// confirms it in the panel, which then calls the regular API.
export type AssistantProposal =
  | {
      id: string;
      kind: "create_task";
      input: {
        title: string;
        description?: string | null;
        dueDate?: string | null;
        priority?: TaskPriority;
        status?: TaskStatus;
        tags?: string[];
      };
    }
  | {
      id: string;
      kind: "update_task";
      taskId: string;
      taskTitle: string;
      changes: {
        title?: string;
        status?: TaskStatus;
        priority?: TaskPriority;
        dueDate?: string | null;
      };
    }
  | {
      id: string;
      kind: "create_event";
      input:
        | { title: string; notes?: string | null; allDay: true; startDate: string; endDate: string }
        | { title: string; notes?: string | null; allDay: false; startsAt: string; endsAt: string };
    };

// Newline-delimited JSON events streamed by POST /api/assistant
export type AssistantStreamEvent =
  | { type: "text"; text: string }
  // A tool started, e.g. "Checking your tasks"
  | { type: "status"; label: string }
  | { type: "proposal"; proposal: AssistantProposal }
  // The provider's own transcript of the conversation so far, sent back
  // unchanged with the next message
  | { type: "done"; history: unknown[] }
  | { type: "error"; message: string };

// Sent to POST /api/assistant
export interface AssistantRequest {
  history: unknown[];
  message: string;
  // What the user did with earlier proposals, e.g. "Created task “Pack”"
  notes?: string[];
}

// src/lib/assistant.ts
// Assistant types shared by the server, the chat panel and Settings. Keep this
// file free of server-only imports.

import type { TaskPriority, TaskStatus } from "@/lib/tasks";
import type { NoteSplitRule } from "@/lib/noteSplit";
import type { JourneyInput } from "@/lib/travel";

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
  provider: AssistantProvider | null;
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
      kind: "create_journey";
      // As POST /api/journeys takes it
      input: JourneyInput;
    }
  | {
      id: string;
      kind: "update_journey";
      journeyId: string;
      // The whole journey as it will be saved: PUT /api/journeys/[id]
      // replaces the row, so the change is already merged onto the current one
      input: JourneyInput;
      // Only the fields that differ, for the card's summary
      changes: Partial<JourneyInput>;
    }
  | {
      id: string;
      kind: "create_event";
      input:
        | { title: string; notes?: string | null; allDay: true; startDate: string; endDate: string }
        | { title: string; notes?: string | null; allDay: false; startsAt: string; endsAt: string };
    }
  | {
      id: string;
      kind: "update_event";
      // The row to PATCH (the series itself when scope is "all")
      eventId: string;
      eventTitle: string;
      // "one" changes a single occurrence of a repeating event, "all" the
      // whole series (or a plain event, which has no series)
      scope: "all" | "one";
      // Whether the event repeats, to word the card correctly
      repeats: boolean;
      // As PATCH /api/events/[id] takes it; timing is present only when it
      // changes, and then as a full all-day or timed pair
      changes: {
        title?: string;
        notes?: string | null;
        exdates?: string[];
        allDay?: boolean;
        startDate?: string;
        endDate?: string;
        startsAt?: string;
        endsAt?: string;
      };
      // scope "one" only: create a standalone event for the occurrence and
      // drop that day from the series, exactly as the calendar's "This event"
      detach?: {
        seriesId: string;
        occurrenceDate: string;
        // As POST /api/events takes it: a standalone event for the occurrence,
        // linked to the series it left (rrule null, seriesId the series)
        create: {
          title: string;
          notes?: string | null;
          rrule?: string | null;
          seriesId?: string | null;
          allDay: boolean;
          startDate?: string;
          endDate?: string;
          startsAt?: string;
          endsAt?: string;
        };
        // The series' exdates once this occurrence is removed from it
        seriesExdates: string[];
      };
    }
  | {
      id: string;
      kind: "create_note";
      // The body as Markdown, turned into the editor's format when confirmed
      input: { title: string; markdown: string; tags?: string[] };
    }
  | {
      id: string;
      kind: "update_note";
      noteId: string;
      noteTitle: string;
      changes: { title?: string; tags?: string[]; appendMarkdown?: string };
    }
  | {
      id: string;
      kind: "split_note";
      noteId: string;
      noteTitle: string;
      // As POST /api/notes/[id]/split takes it
      input: NoteSplitRule & { titles: string[]; expectedUpdatedAt: string };
    };

// Newline-delimited JSON events streamed by POST /api/assistant. The route
// adds "done" once the exchange is saved.
export type AssistantStreamEvent =
  | { type: "text"; text: string }
  // A tool started, e.g. "Checking your tasks"
  | { type: "status"; label: string }
  | { type: "proposal"; proposal: AssistantProposal }
  // The exchange is saved: which conversation it joined (with the provider
  // and model its transcript belongs to), the ids of the two messages made,
  // the transcript length the new user message started at (the rollback
  // anchor) and the length it now has
  | {
      type: "done";
      conversationId: string;
      provider: AssistantProvider;
      model: string;
      userMessageId: string;
      assistantMessageId: string;
      historyLength: number;
      transcriptLength: number;
    }
  | { type: "error"; message: string };

// An image attached to a message (a ticket, a boarding pass…), already
// shrunk in the browser; `data` is base64 without the data: prefix
export interface AssistantImage {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  data: string;
}

// What became of a proposal card. "saving" is a moment on the way and is
// never stored; a saved conversation keeps the other three.
export type ProposalState = "pending" | "saving" | "confirmed" | "dismissed";

// A proposal with its outcome, as saved on an assistant message
export interface StoredProposal {
  proposal: AssistantProposal;
  state: ProposalState;
}

// Per message. Images are shrunk in the browser to stay well under Vercel's
// 4.5 MB request limit; the transcript itself never travels with a request.
export const MAX_IMAGES = 3;
export const MAX_IMAGE_BASE64 = 1_500_000;

// Sent to POST /api/assistant
export interface AssistantRequest {
  // The saved conversation to continue; left out for the first message of a
  // new one, which the server saves and names in the reply's "done" event
  conversationId?: string | null;
  message: string;
  images?: AssistantImage[];
  // What the user did with earlier proposals, e.g. "Created task “Pack”"
  notes?: string[];
}

// ---- Saved conversations, as the API shows them ---------------------------

// One entry of GET /api/assistant/conversations
export interface ConversationSummary {
  id: string;
  // null while the first message was only an image
  title: string | null;
  provider: AssistantProvider;
  model: string;
  updatedAt: string;
}

// A saved message, as GET /api/assistant/conversations/[id] returns it and
// the panel restores it. The provider's transcript itself stays on the
// server; `historyLength` (user messages) is where it stood before that
// message, which is all a rollback needs.
export interface StoredMessage {
  id: string;
  index: number;
  role: "user" | "assistant";
  text: string;
  images: AssistantImage[];
  proposals: StoredProposal[];
  notes: string[];
  historyLength: number | null;
  error: string | null;
}

export interface StoredConversation {
  id: string;
  title: string | null;
  provider: AssistantProvider;
  model: string;
  // Proposal outcomes waiting for the next message
  pendingNotes: string[];
  // The stored transcript's length, kept so the panel can roll back
  transcriptLength: number;
  messages: StoredMessage[];
}


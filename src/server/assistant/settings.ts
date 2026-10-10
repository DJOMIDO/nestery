// src/server/assistant/settings.ts
// Which model and API key the assistant uses for a user, and the daily limit.
//
// Users bring their own key (stored encrypted). The app owner's key
// (ANTHROPIC_API_KEY) is only used for the emails in ASSISTANT_OWNER_EMAILS,
// so other sign-ups never spend it.

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assistantSettings, assistantUsage } from "@/db/schema";
import {
  ASSISTANT_PROVIDERS,
  type AssistantProvider,
  type AssistantSettingsView,
  type AssistantStatus,
} from "@/lib/assistant";
import { anthropicProvider, listAnthropicModels } from "@/server/assistant/providers/anthropic";
import { ProviderError, type ChatProvider } from "@/server/assistant/providers/types";
import { decryptSecret, encryptSecret, secretsEnabled } from "@/server/secrets";

const DEFAULT_MODEL = process.env.ASSISTANT_DEFAULT_MODEL || "claude-opus-5-5";

// Messages per user and day when the owner's key pays; own keys are unlimited
const DAILY_LIMIT = Number(process.env.ASSISTANT_DAILY_LIMIT) || 50;

const ownerEmails = () =>
  (process.env.ASSISTANT_OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const usesServerKey = (email: string) =>
  !!process.env.ANTHROPIC_API_KEY && ownerEmails().includes(email.toLowerCase());

export const saveAssistantSettingsInput = z.object({
  provider: z.enum(ASSISTANT_PROVIDERS),
  model: z.string().trim().min(1, "Choose a model").max(100),
  // A new key; absent keeps the saved one
  apiKey: z.string().trim().min(10, "That doesn't look like an API key").max(500).optional(),
});

export const listModelsInput = z.object({
  provider: z.enum(ASSISTANT_PROVIDERS),
  // Absent: use the saved key
  apiKey: z.string().trim().min(10).max(500).optional(),
});

async function getRow(userId: string) {
  const [row] = await db.select().from(assistantSettings).where(eq(assistantSettings.userId, userId));
  return row ?? null;
}

const savedKey = (row: Awaited<ReturnType<typeof getRow>>) => {
  if (!row?.apiKeyEncrypted || !secretsEnabled()) return null;
  try {
    return decryptSecret(row.apiKeyEncrypted);
  } catch {
    // Encrypted with a key that has since changed: treat as not saved
    return null;
  }
};

export async function getAssistantSettings(userId: string): Promise<AssistantSettingsView | null> {
  const row = await getRow(userId);
  if (!row) return null;
  return {
    provider: row.provider as AssistantProvider,
    model: row.model,
    apiKeyHint: savedKey(row) ? row.apiKeyHint : null,
  };
}

function providerFor(provider: AssistantProvider, apiKey: string, model: string): ChatProvider {
  switch (provider) {
    case "anthropic":
      return anthropicProvider({ apiKey, model });
  }
}

async function listModelsWith(provider: AssistantProvider, apiKey: string) {
  switch (provider) {
    case "anthropic":
      return listAnthropicModels(apiKey);
  }
}

// Model ids for the picker in Settings, with a new key or the saved one
export async function listModels(
  user: { id: string; email: string },
  input: z.infer<typeof listModelsInput>
) {
  const apiKey =
    input.apiKey ?? savedKey(await getRow(user.id)) ?? (usesServerKey(user.email) ? process.env.ANTHROPIC_API_KEY! : null);
  if (!apiKey) throw new ProviderError("Enter an API key first.", 400);
  return listModelsWith(input.provider, apiKey);
}

// Saves the choice after checking that the key works and offers the model
export async function saveAssistantSettings(
  user: { id: string; email: string },
  input: z.infer<typeof saveAssistantSettingsInput>
) {
  if (input.apiKey && !secretsEnabled()) {
    throw new ProviderError("Saving API keys is not set up on this server (ASSISTANT_ENCRYPTION_KEY).", 400);
  }
  const row = await getRow(user.id);
  const apiKey =
    input.apiKey ??
    (row?.provider === input.provider ? savedKey(row) : null) ??
    (usesServerKey(user.email) ? process.env.ANTHROPIC_API_KEY! : null);
  if (!apiKey) throw new ProviderError("Enter an API key.", 400);

  const models = await listModelsWith(input.provider, apiKey);
  if (!models.includes(input.model)) {
    throw new ProviderError(`This key can't use “${input.model}”. Pick one from the list.`, 400);
  }

  // A key typed for another provider must not stay attached to this one
  const keyFields = input.apiKey
    ? { apiKeyEncrypted: encryptSecret(input.apiKey), apiKeyHint: `…${input.apiKey.slice(-4)}` }
    : row?.provider === input.provider
      ? {}
      : { apiKeyEncrypted: null, apiKeyHint: null };
  const values = { provider: input.provider, model: input.model, ...keyFields };
  await db
    .insert(assistantSettings)
    .values({ userId: user.id, ...values })
    .onConflictDoUpdate({ target: assistantSettings.userId, set: values });
  return getAssistantSettings(user.id);
}

export async function deleteAssistantSettings(userId: string) {
  await db.delete(assistantSettings).where(eq(assistantSettings.userId, userId));
}

// The provider to chat with, or null when the user has no usable key
export async function resolveAssistant(user: { id: string; email: string }) {
  const row = await getRow(user.id);
  const ownKey = savedKey(row);
  if (row && ownKey) {
    return {
      source: "own" as const,
      model: row.model,
      provider: providerFor(row.provider as AssistantProvider, ownKey, row.model),
    };
  }
  if (usesServerKey(user.email)) {
    // The owner may pick a model in Settings without saving a key
    const model = row?.provider === "anthropic" ? row.model : DEFAULT_MODEL;
    return {
      source: "server" as const,
      model,
      provider: anthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY!, model }),
    };
  }
  return null;
}

async function usedOn(userId: string, day: string) {
  const [row] = await db
    .select({ requests: assistantUsage.requests })
    .from(assistantUsage)
    .where(and(eq(assistantUsage.userId, userId), eq(assistantUsage.day, day)));
  return row?.requests ?? 0;
}

export async function assistantStatus(user: { id: string; email: string }, day: string): Promise<AssistantStatus> {
  const resolved = await resolveAssistant(user);
  return {
    available: !!resolved,
    source: resolved?.source ?? null,
    model: resolved?.model ?? null,
    canSaveKey: secretsEnabled(),
    dailyLimit: DAILY_LIMIT,
    usedToday: resolved?.source === "server" ? await usedOn(user.id, day) : 0,
  };
}

// Counts one message against the owner's key; false once the day's limit is used
export async function takeServerQuota(userId: string, day: string) {
  const [row] = await db
    .insert(assistantUsage)
    .values({ userId, day, requests: 1 })
    .onConflictDoUpdate({
      target: [assistantUsage.userId, assistantUsage.day],
      set: { requests: sql`${assistantUsage.requests} + 1` },
    })
    .returning({ requests: assistantUsage.requests });
  return row.requests <= DAILY_LIMIT;
}

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
  PROVIDER_BASE_URLS,
  type AssistantProvider,
  type AssistantSettingsView,
  type AssistantStatus,
} from "@/lib/assistant";
import { anthropicProvider, listAnthropicModels } from "@/server/assistant/providers/anthropic";
import { listOpenAIModels, openaiProvider } from "@/server/assistant/providers/openai";
import { ProviderError } from "@/server/assistant/providers/types";
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

const apiKeyField = z.string().trim().min(10, "That doesn't look like an API key").max(500);
const baseUrlField = z.string().trim().url("Enter a link such as https://api.example.com/v1").max(500);

// "Other" providers need their own base URL
const needsBaseUrl = (v: { provider: AssistantProvider; baseUrl?: string }) => v.provider !== "custom" || !!v.baseUrl;
const BASE_URL_REQUIRED = { message: "Enter the provider's base URL", path: ["baseUrl"] };

export const saveAssistantSettingsInput = z
  .object({
    provider: z.enum(ASSISTANT_PROVIDERS),
    model: z.string().trim().min(1, "Choose a model").max(200),
    // A new key; absent keeps the saved one
    apiKey: apiKeyField.optional(),
    baseUrl: baseUrlField.optional(),
  })
  .refine(needsBaseUrl, BASE_URL_REQUIRED);

export const listModelsInput = z
  .object({
    provider: z.enum(ASSISTANT_PROVIDERS),
    // Absent: use the saved key
    apiKey: apiKeyField.optional(),
    baseUrl: baseUrlField.optional(),
  })
  .refine(needsBaseUrl, BASE_URL_REQUIRED);

const baseUrlFor = (provider: AssistantProvider, custom: string | null | undefined) =>
  provider === "custom" ? custom! : PROVIDER_BASE_URLS[provider]!;

// Local servers (LM Studio, Ollama) usually work without a key
const keyOptional = (provider: AssistantProvider) => provider === "custom";

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
    baseUrl: row.baseUrl,
    apiKeyHint: savedKey(row) ? row.apiKeyHint : null,
  };
}

function providerFor(provider: AssistantProvider, apiKey: string | null, model: string, baseUrl: string | null) {
  return provider === "anthropic"
    ? anthropicProvider({ apiKey: apiKey!, model })
    : openaiProvider({ apiKey, model, baseUrl: baseUrlFor(provider, baseUrl) });
}

const listModelsWith = (provider: AssistantProvider, apiKey: string | null, baseUrl: string | null | undefined) =>
  provider === "anthropic" ? listAnthropicModels(apiKey!) : listOpenAIModels(apiKey, baseUrlFor(provider, baseUrl));

// The key to use when none is typed: the saved one for the same provider, or
// the owner's Anthropic key
async function existingKey(user: { id: string; email: string }, provider: AssistantProvider) {
  const row = await getRow(user.id);
  const saved = row?.provider === provider ? savedKey(row) : null;
  return saved ?? (provider === "anthropic" && usesServerKey(user.email) ? process.env.ANTHROPIC_API_KEY! : null);
}

// Model ids for the picker in Settings, with a new key or the saved one
export async function listModels(
  user: { id: string; email: string },
  input: z.infer<typeof listModelsInput>
) {
  const apiKey = input.apiKey ?? (await existingKey(user, input.provider));
  if (!apiKey && !keyOptional(input.provider)) throw new ProviderError("Enter an API key first.", 400);
  return listModelsWith(input.provider, apiKey, input.baseUrl);
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
  const apiKey = input.apiKey ?? (await existingKey(user, input.provider));
  if (!apiKey && !keyOptional(input.provider)) throw new ProviderError("Enter an API key.", 400);

  const models = await listModelsWith(input.provider, apiKey, input.baseUrl);
  if (!models.includes(input.model)) {
    throw new ProviderError(`This key can't use “${input.model}”. Pick one from the list.`, 400);
  }

  // A key typed for another provider must not stay attached to this one
  const keyFields = input.apiKey
    ? { apiKeyEncrypted: encryptSecret(input.apiKey), apiKeyHint: `…${input.apiKey.slice(-4)}` }
    : row?.provider === input.provider
      ? {}
      : { apiKeyEncrypted: null, apiKeyHint: null };
  const values = {
    provider: input.provider,
    model: input.model,
    baseUrl: input.provider === "custom" ? input.baseUrl! : null,
    ...keyFields,
  };
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
  if (row && (ownKey || keyOptional(row.provider as AssistantProvider))) {
    return {
      source: "own" as const,
      model: row.model,
      provider: providerFor(row.provider as AssistantProvider, ownKey, row.model, row.baseUrl),
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

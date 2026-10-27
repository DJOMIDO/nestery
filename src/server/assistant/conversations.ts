// src/server/assistant/conversations.ts
// Saved assistant conversations: what the panel shows (messages, proposals
// and their outcomes) plus the provider's transcript, which stays here. The
// browser only names a conversation by id; a rollback truncates the stored
// transcript to the length it had before one of the conversation's messages.

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assistantConversations, assistantMessages } from "@/db/schema";
import {
  ASSISTANT_PROVIDERS,
  type AssistantImage,
  type AssistantProposal,
  type ConversationSummary,
  type StoredConversation,
  type StoredMessage,
} from "@/lib/assistant";
import { notFound } from "@/server/session";

// Conversations kept per user; the oldest go when a newer one is saved
const MAX_CONVERSATIONS = 50;

// Proposal cards settle to "confirmed" or "dismissed"; "saving" is a moment
// on the way and is never worth storing
export const proposalStateInput = z.enum(["pending", "confirmed", "dismissed"]);

export const rollbackInput = z.object({
  // The user message to replay: it and everything after it are deleted
  messageIndex: z.number().int().min(0),
  // The transcript length recorded on that message
  historyLength: z.number().int().min(0),
});

export const settleInput = z.object({
  proposalId: z.string().min(1),
  state: proposalStateInput,
  // What the assistant is told with the next message (kept on the
  // conversation when the card settles for good)
  note: z.string().max(500).optional(),
});

// A conversation that is not the signed-in user's
export class ConversationForbidden extends Error {}

// A conversation id that matches nothing
export class ConversationMissing extends Error {}

// Another user's conversation is not told apart from a missing one
export function conversationErrorResponse(err: unknown) {
  if (err instanceof ConversationForbidden || err instanceof ConversationMissing) return notFound();
  throw err;
}

const ownConversation = async (userId: string, id: string) => {
  const [row] = await db.select().from(assistantConversations).where(eq(assistantConversations.id, id));
  if (!row) throw new ConversationMissing();
  if (row.userId !== userId) throw new ConversationForbidden();
  return row;
};

const asSummary = (row: {
  id: string;
  title: string | null;
  provider: string;
  model: string;
  updatedAt: Date;
}): ConversationSummary => ({
  id: row.id,
  title: row.title,
  provider: row.provider as ConversationSummary["provider"],
  model: row.model,
  updatedAt: row.updatedAt.toISOString(),
});

const asMessage = (row: typeof assistantMessages.$inferSelect): StoredMessage => ({
  id: row.id,
  index: row.index,
  role: row.role === "assistant" ? "assistant" : "user",
  text: row.text,
  images: row.images as AssistantImage[],
  proposals: row.proposals as StoredMessage["proposals"],
  notes: row.notes,
  historyLength: row.historyLength,
  error: row.error,
});

export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const rows = await db
    .select({
      id: assistantConversations.id,
      title: assistantConversations.title,
      provider: assistantConversations.provider,
      model: assistantConversations.model,
      updatedAt: assistantConversations.updatedAt,
    })
    .from(assistantConversations)
    .where(eq(assistantConversations.userId, userId))
    .orderBy(desc(assistantConversations.updatedAt));
  return rows.map(asSummary);
}

export async function getConversation(userId: string, id: string): Promise<StoredConversation> {
  const row = await ownConversation(userId, id);
  const messages = await db
    .select()
    .from(assistantMessages)
    .where(eq(assistantMessages.conversationId, id))
    .orderBy(assistantMessages.index);
  return {
    id: row.id,
    title: row.title,
    provider: row.provider as StoredConversation["provider"],
    model: row.model,
    pendingNotes: row.pendingNotes,
    transcriptLength: (row.transcript as unknown[]).length,
    messages: messages.map(asMessage),
  };
}

export async function deleteConversation(userId: string, id: string) {
  // Messages go with it (onDelete cascade)
  await db
    .delete(assistantConversations)
    .where(and(eq(assistantConversations.id, id), eq(assistantConversations.userId, userId)));
}

// The conversation to continue: its row and the transcript to append to
export async function conversationForRequest(userId: string, id: string | null | undefined) {
  if (!id) return { row: null, transcript: [] as unknown[] };
  const row = await ownConversation(userId, id);
  return { row, transcript: row.transcript as unknown[] };
}

// The first words of the first message become the title
const titleFrom = (message: string) => message.replace(/\s+/g, " ").trim().slice(0, 60) || null;

export interface ExchangeToSave {
  conversationId: string | null;
  userId: string;
  provider: (typeof ASSISTANT_PROVIDERS)[number];
  model: string;
  message: string;
  images: AssistantImage[];
  // The proposal outcomes sent with the message
  notes: string[];
  // The transcript length the message started at (the rollback anchor)
  historyLength: number;
  // The provider's transcript once the reply finished
  transcript: unknown[];
  replyText: string;
  proposals: { proposal: AssistantProposal; state: string }[];
  replyError: string | null;
}

// Saves one finished exchange (the user's message and the reply) and returns
// what the panel needs to keep going: the conversation's id, the two saved
// messages' ids and the transcript's lengths around the exchange. The
// conversation row is made here, on the first exchange.
export async function saveExchange(exchange: ExchangeToSave) {
  let conversationId = exchange.conversationId;
  let index = 0;
  if (conversationId) {
    const [last] = await db
      .select({ index: assistantMessages.index })
      .from(assistantMessages)
      .where(eq(assistantMessages.conversationId, conversationId))
      .orderBy(desc(assistantMessages.index))
      .limit(1);
    index = (last?.index ?? -1) + 1;
  } else {
    const [row] = await db
      .insert(assistantConversations)
      .values({
        userId: exchange.userId,
        title: titleFrom(exchange.message),
        provider: exchange.provider,
        model: exchange.model,
        transcript: exchange.transcript,
      })
      .returning({ id: assistantConversations.id });
    conversationId = row.id;
  }

  const inserted = await db
    .insert(assistantMessages)
    .values([
      {
        conversationId,
        index,
        role: "user",
        text: exchange.message,
        images: exchange.images,
        notes: exchange.notes,
        historyLength: exchange.historyLength,
      },
      {
        conversationId,
        index: index + 1,
        role: "assistant",
        text: exchange.replyText,
        proposals: exchange.proposals,
        error: exchange.replyError,
      },
    ])
    .returning({ id: assistantMessages.id, role: assistantMessages.role });

  if (exchange.conversationId) {
    // The proposal outcomes went out with this message
    await db
      .update(assistantConversations)
      .set({ transcript: exchange.transcript, pendingNotes: [], updatedAt: new Date() })
      .where(eq(assistantConversations.id, conversationId));
  }

  await pruneConversations(exchange.userId);
  return {
    conversationId,
    userMessageId: inserted.find((row) => row.role === "user")!.id,
    assistantMessageId: inserted.find((row) => row.role === "assistant")!.id,
    historyLength: exchange.historyLength,
    transcriptLength: exchange.transcript.length,
  };
}

// Rolls a conversation back to just before one of its messages, so the panel
// can replay it: that message and the ones after it are deleted, the
// transcript is truncated to what it was before, and the proposal outcomes
// sent with it wait again for the next message.
export async function rollbackConversation(
  userId: string,
  id: string,
  input: z.infer<typeof rollbackInput>
) {
  const row = await ownConversation(userId, id);
  const [target] = await db
    .select()
    .from(assistantMessages)
    .where(and(eq(assistantMessages.conversationId, id), eq(assistantMessages.index, input.messageIndex)));
  if (!target || target.role !== "user" || target.historyLength === null) throw new ConversationMissing();

  await db
    .delete(assistantMessages)
    .where(and(eq(assistantMessages.conversationId, id), sql`${assistantMessages.index} >= ${input.messageIndex}`));
  await db
    .update(assistantConversations)
    .set({
      transcript: (row.transcript as unknown[]).slice(0, input.historyLength),
      pendingNotes: target.notes,
      updatedAt: new Date(),
    })
    .where(eq(assistantConversations.id, id));
}

// Records how a proposal card settled, so a reloaded conversation shows the
// same outcome; a settled card's note also waits there for the next message
export async function settleProposal(
  userId: string,
  messageId: string,
  input: z.infer<typeof settleInput>
) {
  const [message] = await db
    .select()
    .from(assistantMessages)
    .where(eq(assistantMessages.id, messageId));
  if (!message) throw new ConversationMissing();
  await ownConversation(userId, message.conversationId);

  const proposals = message.proposals as StoredMessage["proposals"];
  const next = proposals.map((p) => (p.proposal.id === input.proposalId ? { ...p, state: input.state } : p));
  await db
    .update(assistantMessages)
    .set({ proposals: next })
    .where(eq(assistantMessages.id, messageId));

  if (input.note && input.state !== "pending") {
    await db
      .update(assistantConversations)
      .set({ pendingNotes: sql`${assistantConversations.pendingNotes} || ${JSON.stringify([input.note])}::jsonb` })
      .where(eq(assistantConversations.id, message.conversationId));
  }
}

// Drops the conversations past the limit, oldest first
async function pruneConversations(userId: string) {
  const rows = await db
    .select({ id: assistantConversations.id })
    .from(assistantConversations)
    .where(eq(assistantConversations.userId, userId))
    .orderBy(desc(assistantConversations.updatedAt));
  const extra = rows.slice(MAX_CONVERSATIONS).map((row) => row.id);
  if (extra.length > 0) {
    await db.delete(assistantConversations).where(inArray(assistantConversations.id, extra));
  }
}

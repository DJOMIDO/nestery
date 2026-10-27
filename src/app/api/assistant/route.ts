// src/app/api/assistant/route.ts

import { NextResponse } from "next/server";
import { translateError } from "@/server/i18n";
import { z } from "zod";
import { MAX_IMAGE_BASE64, MAX_IMAGES, type AssistantStreamEvent } from "@/lib/assistant";
import { runAssistant, type AssistantRunResult } from "@/server/assistant/agent";
import {
  ConversationForbidden,
  ConversationMissing,
  conversationForRequest,
  saveExchange,
} from "@/server/assistant/conversations";
import { ProviderError } from "@/server/assistant/providers/types";
import { assistantStatus, resolveAssistant, takeServerQuota } from "@/server/assistant/settings";
import { todayIn } from "@/server/assistant/tools";
import { requestLocale } from "@/i18n/request";
import { getSettings } from "@/server/settings";
import { errorResponse, getSessionUser, notFound, parseInput, unauthorized } from "@/server/session";

// A few model calls with tools can take a while
export const maxDuration = 120;

// Images make a message's body grow; long conversations live in the database
// now, so only one message travels per request. Below Vercel's 4.5 MB limit.
const MAX_REQUEST_BYTES = 4_000_000;

const assistantInput = z
  .object({
    // The saved conversation to continue; a new one is made when absent
    conversationId: z.string().uuid().nullable().optional(),
    message: z.string().trim().max(4000, "That message is too long").default(""),
    images: z
      .array(
        z.object({
          mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
          data: z
            .string()
            .max(MAX_IMAGE_BASE64, "An image is too large")
            .regex(/^[A-Za-z0-9+/]+=*$/, "An image is not valid"),
        })
      )
      .max(MAX_IMAGES, `Attach at most ${MAX_IMAGES} images`)
      .default([]),
    notes: z.array(z.string().max(500)).max(20).default([]),
  })
  .refine((v) => v.message || v.images.length > 0, "Type a message");

// GET /api/assistant: whether the assistant can be used, and with whose key
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { timeZone } = await getSettings(user.id);
  return NextResponse.json(await assistantStatus(user, todayIn(timeZone ?? "UTC")));
}

// POST /api/assistant: one user message; streams AssistantStreamEvent lines
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const raw = await request.text();
  if (raw.length > MAX_REQUEST_BYTES) {
    return await errorResponse("That message is too large. Try fewer or smaller images.", 413);
  }
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {}
  const input = await parseInput(assistantInput, body);
  if ("response" in input) return input.response;

  const assistant = await resolveAssistant(user);
  if (!assistant) {
    return await errorResponse("Set up the assistant in Settings > Assistant first.", 400);
  }

  // The stored transcript is the conversation the client named (or a new
  // one); it is never sent to the browser, only appended to here
  let transcript: unknown[];
  try {
    const conversation = await conversationForRequest(user.id, input.data.conversationId);
    if (conversation.row && conversation.row.provider !== assistant.providerName) {
      return await errorResponse("This conversation was with another model. Start a new one.", 400);
    }
    // Cheap insurance against a transcript that cannot be sent to this model
    if (!assistant.provider.isHistory(conversation.transcript)) {
      return await errorResponse("This conversation was with another model. Start a new one.", 400);
    }
    transcript = conversation.transcript;
  } catch (err) {
    if (err instanceof ConversationForbidden || err instanceof ConversationMissing) return notFound();
    throw err;
  }

  const settings = await getSettings(user.id);
  const timeZone = settings.timeZone ?? "UTC";
  const today = todayIn(timeZone);
  if (assistant.source === "server" && !(await takeServerQuota(user.id, today))) {
    return await errorResponse("You've reached today's limit for the assistant.", 429);
  }

  const encoder = new TextEncoder();
  // Read while handling the request (the stream runs after it returns)
  const locale = await requestLocale();
  const historyLength = transcript.length;
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: AssistantStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      // Set once the run finished; an interrupted or failed exchange is not
      // saved, exactly as it was not remembered before
      let result: AssistantRunResult | null = null;
      let replyError: string | null = null;
      try {
        result = await runAssistant({
          provider: assistant.provider,
          userId: user.id,
          timeZone,
          today,
          dateTime: {
            dateLocale: settings.dateLocale,
            hourCycle: settings.hourCycle,
            weekStart: settings.weekStart,
            temperatureUnit: settings.temperatureUnit,
          },
          locale,
          place: settings.weatherPlace,
          history: transcript,
          message: input.data.message,
          images: input.data.images,
          notes: input.data.notes,
          emit,
          signal: request.signal,
        });
      } catch (err) {
        if (!request.signal.aborted) {
          if (!(err instanceof ProviderError)) console.error("Assistant failed", err);
          replyError = await translateError(
            err instanceof ProviderError ? err.message : "The assistant failed unexpectedly.",
            locale
          );
          emit({ type: "error", message: replyError });
        }
      }
      // A finished run is saved (with the reply's proposals and any error the
      // provider reported along the way), then the exchange is acknowledged;
      // the client keeps unsaved exchanges out of the conversation
      if (result) {
        try {
          const saved = await saveExchange({
            conversationId: input.data.conversationId ?? null,
            userId: user.id,
            provider: assistant.providerName,
            model: assistant.model,
            message: input.data.message,
            images: input.data.images,
            notes: input.data.notes,
            historyLength,
            transcript: result.transcript,
            replyText: result.replyText,
            proposals: result.proposals.map((proposal) => ({ proposal, state: "pending" })),
            replyError,
          });
          emit({
            type: "done",
            conversationId: saved.conversationId,
            provider: assistant.providerName,
            model: assistant.model,
            userMessageId: saved.userMessageId,
            assistantMessageId: saved.assistantMessageId,
            historyLength: saved.historyLength,
            transcriptLength: saved.transcriptLength,
          });
        } catch (err) {
          console.error("Saving the conversation failed", err);
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

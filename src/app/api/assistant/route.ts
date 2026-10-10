// src/app/api/assistant/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import type { AssistantStreamEvent } from "@/lib/assistant";
import { runAssistant } from "@/server/assistant/agent";
import { ProviderError } from "@/server/assistant/providers/types";
import { assistantStatus, resolveAssistant, takeServerQuota } from "@/server/assistant/settings";
import { todayIn } from "@/server/assistant/tools";
import { getSettings } from "@/server/settings";
import { getSessionUser, parseInput, unauthorized } from "@/server/session";

// A few model calls with tools can take a while
export const maxDuration = 120;

// Long conversations cost more on every message; start a new one past this
const MAX_REQUEST_BYTES = 1_000_000;

const assistantInput = z.object({
  history: z.array(z.unknown()).max(500),
  message: z.string().trim().min(1, "Type a message").max(4000, "That message is too long"),
  notes: z.array(z.string().max(500)).max(20).default([]),
});

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
    return NextResponse.json({ error: "This conversation is too long. Start a new one." }, { status: 413 });
  }
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {}
  const input = await parseInput(assistantInput, body);
  if ("response" in input) return input.response;

  const assistant = await resolveAssistant(user);
  if (!assistant) {
    return NextResponse.json({ error: "Set up the assistant in Settings > Assistant first." }, { status: 400 });
  }
  if (!assistant.provider.isHistory(input.data.history)) {
    return NextResponse.json({ error: "This conversation was with another model. Start a new one." }, { status: 400 });
  }

  const settings = await getSettings(user.id);
  const timeZone = settings.timeZone ?? "UTC";
  const today = todayIn(timeZone);
  if (assistant.source === "server" && !(await takeServerQuota(user.id, today))) {
    return NextResponse.json({ error: "You've reached today's limit for the assistant." }, { status: 429 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: AssistantStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await runAssistant({
          provider: assistant.provider,
          userId: user.id,
          timeZone,
          today,
          place: settings.weatherPlace,
          history: input.data.history,
          message: input.data.message,
          notes: input.data.notes,
          emit,
          signal: request.signal,
        });
      } catch (err) {
        if (!request.signal.aborted) {
          if (!(err instanceof ProviderError)) console.error("Assistant failed", err);
          emit({
            type: "error",
            message: err instanceof ProviderError ? err.message : "The assistant failed unexpectedly.",
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

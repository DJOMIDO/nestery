// src/app/api/events/route.ts

import { NextResponse } from "next/server";
import {
  createEvent,
  createEventInput,
  listEvents,
  listEventsInput,
} from "@/server/events";
import { getUserId, parseInput, unauthorized } from "@/server/session";

// GET /api/events?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const range = await parseInput(listEventsInput, params);
  if ("response" in range) return range.response;

  return NextResponse.json(await listEvents(userId, range.data));
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const input = await parseInput(
    createEventInput,
    await request.json().catch(() => null)
  );
  if ("response" in input) return input.response;

  return NextResponse.json(await createEvent(userId, input.data), {
    status: 201,
  });
}

// src/app/api/subscriptions/events/route.ts

import { NextResponse } from "next/server";
import { subscriptionEvents, subscriptionEventsInput } from "@/server/subscriptions";
import { getUserId, parseInput, unauthorized } from "@/server/session";

// GET /api/subscriptions/events?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=Europe/Paris
export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const range = await parseInput(subscriptionEventsInput, params);
  if ("response" in range) return range.response;

  return NextResponse.json(await subscriptionEvents(userId, range.data));
}

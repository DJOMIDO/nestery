// src/app/api/calendar/feed-token/route.ts
// Turns the calendar feed on (or gives it a new link) and off.

import { NextResponse } from "next/server";
import { createFeedToken, revokeFeedToken } from "@/server/settings";
import { getUserId, unauthorized } from "@/server/session";

// Creates a new secret link; the old one, if any, stops working
export async function POST() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  return NextResponse.json(await createFeedToken(userId));
}

export async function DELETE() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  return NextResponse.json(await revokeFeedToken(userId));
}

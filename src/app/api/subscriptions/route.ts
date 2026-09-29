// src/app/api/subscriptions/route.ts

import { NextResponse } from "next/server";
import { FeedError } from "@/server/fetchIcs";
import {
  createSubscription,
  createSubscriptionInput,
  listSubscriptions,
} from "@/server/subscriptions";
import { getUserId, parseInput, unauthorized } from "@/server/session";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  return NextResponse.json(await listSubscriptions(userId));
}

// Fetches the feed first, so an unreachable or invalid link is a 400 with a reason
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const input = await parseInput(
    createSubscriptionInput,
    await request.json().catch(() => null)
  );
  if ("response" in input) return input.response;

  try {
    return NextResponse.json(await createSubscription(userId, input.data), { status: 201 });
  } catch (err) {
    if (err instanceof FeedError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

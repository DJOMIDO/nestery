// src/app/api/journeys/route.ts

import { NextResponse } from "next/server";
import { getUserId, parseInput, unauthorized } from "@/server/session";
import { createJourney, DuplicateJourneyError, journeyInput, listJourneys } from "@/server/travel";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  return NextResponse.json(await listJourneys(userId));
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const input = await parseInput(journeyInput, await request.json().catch(() => null));
  if ("response" in input) return input.response;

  try {
    return NextResponse.json(await createJourney(userId, input.data), { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateJourneyError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}

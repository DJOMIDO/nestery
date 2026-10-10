// src/app/api/journeys/import/route.ts

import { NextResponse } from "next/server";
import { getUserId, parseInput, unauthorized } from "@/server/session";
import { importJourneys, importJourneysInput } from "@/server/travel";

// POST /api/journeys/import: { rows: JourneyInput[] } from a parsed CSV file
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const input = await parseInput(importJourneysInput, await request.json().catch(() => null));
  if ("response" in input) return input.response;

  return NextResponse.json(await importJourneys(userId, input.data.rows));
}

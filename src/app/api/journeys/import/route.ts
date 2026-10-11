// src/app/api/journeys/import/route.ts

import { NextResponse } from "next/server";
import { translateError } from "@/server/i18n";
import { getUserId, parseInput, unauthorized } from "@/server/session";
import { importJourneys, importJourneysInput } from "@/server/travel";

// POST /api/journeys/import: { rows: JourneyInput[] } from a parsed CSV file
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const input = await parseInput(importJourneysInput, await request.json().catch(() => null));
  if ("response" in input) return input.response;

  const result = await importJourneys(userId, input.data.rows);
  // Each row's problem, in the request's language
  const errors = await Promise.all(result.errors.map(async (e) => ({ ...e, message: await translateError(e.message) })));
  return NextResponse.json({ ...result, errors });
}

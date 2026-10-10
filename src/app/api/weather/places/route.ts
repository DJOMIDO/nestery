// src/app/api/weather/places/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserId, parseInput, unauthorized } from "@/server/session";
import { searchPlaces } from "@/server/weather";

const placesInput = z.object({
  q: z.string().trim().min(2, "Type at least 2 letters").max(100),
});

// GET /api/weather/places?q=paris: places for Settings > Weather
export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const input = await parseInput(placesInput, params);
  if ("response" in input) return input.response;

  try {
    return NextResponse.json(await searchPlaces(input.data.q));
  } catch {
    return NextResponse.json({ error: "Place search is unavailable right now" }, { status: 502 });
  }
}

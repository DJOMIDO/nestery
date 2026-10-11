// src/app/api/weather/places/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, getUserId, parseInput, unauthorized } from "@/server/session";
import { searchPlaces } from "@/server/weather";
import { requestLocale } from "@/i18n/request";

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
    // Place names in the interface language: GeoNames has "zh", "fr", "en"…
    const language = (await requestLocale()).split("-")[0];
    return NextResponse.json(await searchPlaces(input.data.q, language));
  } catch {
    return await errorResponse("Place search is unavailable right now", 502);
  }
}

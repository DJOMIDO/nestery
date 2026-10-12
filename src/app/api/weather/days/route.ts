// src/app/api/weather/days/route.ts

import { NextResponse } from "next/server";
import { getSettings } from "@/server/settings";
import { errorResponse, getUserId, unauthorized } from "@/server/session";
import { dailyForecast } from "@/server/weather";

// GET /api/weather/days: { place, days } with the next two weeks' forecast
// at the place chosen in Settings, dated in the user's zone; null when no
// place is chosen yet
export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { weatherPlace, timeZone } = await getSettings(userId);
  if (!weatherPlace) return NextResponse.json(null);

  try {
    return NextResponse.json({ place: weatherPlace.name, days: await dailyForecast(weatherPlace, timeZone, 14) });
  } catch {
    return await errorResponse("Weather is unavailable right now", 502);
  }
}

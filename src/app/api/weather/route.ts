// src/app/api/weather/route.ts

import { NextResponse } from "next/server";
import { getSettings } from "@/server/settings";
import { getUserId, unauthorized } from "@/server/session";
import { todayWeather } from "@/server/weather";

// GET /api/weather: today's weather at the place chosen in Settings, or null
// when none is chosen yet
export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { weatherPlace, timeZone } = await getSettings(userId);
  if (!weatherPlace) return NextResponse.json(null);

  try {
    return NextResponse.json(await todayWeather(weatherPlace, timeZone));
  } catch {
    return NextResponse.json({ error: "Weather is unavailable right now" }, { status: 502 });
  }
}

// src/app/api/journeys/weather/route.ts

import { NextResponse } from "next/server";
import { todayIn } from "@/server/assistant/tools";
import { getSettings } from "@/server/settings";
import { getUserId, unauthorized } from "@/server/session";
import { journeyWeather } from "@/server/travelWeather";

// GET /api/journeys/weather: { [journeyId]: forecast at the destination on
// arrival } for journeys arriving in the next two weeks
export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { timeZone } = await getSettings(userId);
  try {
    return NextResponse.json(await journeyWeather(userId, todayIn(timeZone ?? "UTC")));
  } catch {
    // Weather is extra: the page works without it
    return NextResponse.json({});
  }
}

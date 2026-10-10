// src/app/api/travel/airports/route.ts

import { NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/server/session";
import { searchAirports } from "@/server/travel";

// GET /api/travel/airports?q=…: suggestions for the journey form
export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 100);
  return NextResponse.json(searchAirports(q), { headers: { "Cache-Control": "private, max-age=3600" } });
}

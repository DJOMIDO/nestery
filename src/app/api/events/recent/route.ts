// src/app/api/events/recent/route.ts

import { NextResponse } from "next/server";
import { recentEvents } from "@/server/events";
import { getUserId, unauthorized } from "@/server/session";

// GET /api/events/recent: the latest added or edited events
export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  return NextResponse.json(await recentEvents(userId));
}

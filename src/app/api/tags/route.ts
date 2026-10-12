// src/app/api/tags/route.ts

import { NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/server/session";
import { listTags } from "@/server/tags";

// GET /api/tags: [{ tag, count }] across tasks and notes, most used first,
// for suggesting tags as they are typed
export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  return NextResponse.json(await listTags(userId));
}

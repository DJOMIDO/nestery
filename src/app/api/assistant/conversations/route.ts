// src/app/api/assistant/conversations/route.ts

import { NextResponse } from "next/server";
import { listConversations } from "@/server/assistant/conversations";
import { getUserId, unauthorized } from "@/server/session";

// GET /api/assistant/conversations: the saved conversations, newest first
export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  return NextResponse.json(await listConversations(userId));
}

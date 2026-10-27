// src/app/api/assistant/conversations/[id]/rollback/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  conversationErrorResponse,
  rollbackConversation,
  rollbackInput,
} from "@/server/assistant/conversations";
import { getUserId, notFound, parseInput, unauthorized } from "@/server/session";

type Context = { params: Promise<{ id: string }> };

const isUuid = (id: string) => z.string().uuid().safeParse(id).success;

// POST /api/assistant/conversations/[id]/rollback: cut a conversation back
// to just before one of its messages (deleted) and its transcript to what it
// was before, so the panel can replay that message
export async function POST(request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const input = await parseInput(rollbackInput, await request.json().catch(() => null));
  if ("response" in input) return input.response;

  try {
    await rollbackConversation(userId, id, input.data);
  } catch (err) {
    return conversationErrorResponse(err);
  }
  return new NextResponse(null, { status: 204 });
}

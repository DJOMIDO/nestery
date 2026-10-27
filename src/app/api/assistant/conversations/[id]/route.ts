// src/app/api/assistant/conversations/[id]/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteConversation, getConversation, conversationErrorResponse } from "@/server/assistant/conversations";
import { getUserId, notFound, unauthorized } from "@/server/session";

type Context = { params: Promise<{ id: string }> };

const isUuid = (id: string) => z.string().uuid().safeParse(id).success;

// GET /api/assistant/conversations/[id]: a saved conversation with its
// messages, as the panel restores it (the transcript itself stays server-side)
export async function GET(_request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!isUuid(id)) return notFound();
  try {
    return NextResponse.json(await getConversation(userId, id));
  } catch (err) {
    return conversationErrorResponse(err);
  }
}

// DELETE /api/assistant/conversations/[id]: forgets the conversation
export async function DELETE(_request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!isUuid(id)) return notFound();
  await deleteConversation(userId, id);
  return new NextResponse(null, { status: 204 });
}

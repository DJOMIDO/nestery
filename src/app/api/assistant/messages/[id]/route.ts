// src/app/api/assistant/messages/[id]/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  conversationErrorResponse,
  settleInput,
  settleProposal,
} from "@/server/assistant/conversations";
import { getUserId, notFound, parseInput, unauthorized } from "@/server/session";

type Context = { params: Promise<{ id: string }> };

const isUuid = (id: string) => z.string().uuid().safeParse(id).success;

// PATCH /api/assistant/messages/[id]: how a proposal card settled, so a
// reloaded conversation shows the same outcome
export async function PATCH(request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const input = await parseInput(settleInput, await request.json().catch(() => null));
  if ("response" in input) return input.response;

  try {
    await settleProposal(userId, id, input.data);
  } catch (err) {
    return conversationErrorResponse(err);
  }
  return new NextResponse(null, { status: 204 });
}

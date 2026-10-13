// src/app/api/notes/[id]/split/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import { SplitError, splitNote, splitNoteInput } from "@/server/notes";
import { errorResponse, getUserId, notFound, parseInput, unauthorized } from "@/server/session";

type Context = { params: Promise<{ id: string }> };

// POST /api/notes/[id]/split: moves each part after the first into a new note
export async function POST(request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return notFound();

  const input = await parseInput(splitNoteInput, await request.json().catch(() => null));
  if ("response" in input) return input.response;

  try {
    const result = await splitNote(userId, id, input.data);
    return result ? NextResponse.json(result) : notFound();
  } catch (err) {
    if (err instanceof SplitError) return await errorResponse(err.message, 409);
    throw err;
  }
}

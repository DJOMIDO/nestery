// src/app/api/notes/route.ts

import { NextResponse } from "next/server";
import { createNote, createNoteInput, listNotes } from "@/server/notes";
import { getUserId, parseInput, unauthorized } from "@/server/session";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  return NextResponse.json(await listNotes(userId));
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const input = await parseInput(
    createNoteInput,
    await request.json().catch(() => ({}))
  );
  if ("response" in input) return input.response;

  return NextResponse.json(await createNote(userId, input.data), {
    status: 201,
  });
}

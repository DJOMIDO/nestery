// src/app/api/notes/[id]/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteNote,
  getNote,
  updateNote,
  updateNoteInput,
} from "@/server/notes";
import {
  getUserId,
  notFound,
  parseInput,
  unauthorized,
} from "@/server/session";

type Context = { params: Promise<{ id: string }> };

const isUuid = (id: string) => z.string().uuid().safeParse(id).success;

export async function GET(_request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const note = isUuid(id) ? await getNote(userId, id) : null;
  return note ? NextResponse.json(note) : notFound();
}

export async function PATCH(request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const input = await parseInput(
    updateNoteInput,
    await request.json().catch(() => null)
  );
  if ("response" in input) return input.response;

  const note = await updateNote(userId, id, input.data);
  return note ? NextResponse.json(note) : notFound();
}

export async function DELETE(_request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!isUuid(id) || !(await deleteNote(userId, id))) return notFound();
  return new NextResponse(null, { status: 204 });
}

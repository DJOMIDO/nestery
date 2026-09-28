// src/app/api/events/[id]/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteEvent, updateEvent, updateEventInput } from "@/server/events";
import {
  getUserId,
  notFound,
  parseInput,
  unauthorized,
} from "@/server/session";

type Context = { params: Promise<{ id: string }> };

const isUuid = (id: string) => z.string().uuid().safeParse(id).success;

export async function PATCH(request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const input = await parseInput(
    updateEventInput,
    await request.json().catch(() => null)
  );
  if ("response" in input) return input.response;

  const event = await updateEvent(userId, id, input.data);
  return event ? NextResponse.json(event) : notFound();
}

export async function DELETE(_request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!isUuid(id) || !(await deleteEvent(userId, id))) return notFound();
  return new NextResponse(null, { status: 204 });
}

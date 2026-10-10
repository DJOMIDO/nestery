// src/app/api/journeys/[id]/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserId, notFound, parseInput, unauthorized } from "@/server/session";
import { deleteJourney, DuplicateJourneyError, journeyInput, updateJourney } from "@/server/travel";

type Context = { params: Promise<{ id: string }> };

const isUuid = (id: string) => z.string().uuid().safeParse(id).success;

// PUT: the whole journey, as the form sends it
export async function PUT(request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const input = await parseInput(journeyInput, await request.json().catch(() => null));
  if ("response" in input) return input.response;

  try {
    const journey = await updateJourney(userId, id, input.data);
    return journey ? NextResponse.json(journey) : notFound();
  } catch (err) {
    if (err instanceof DuplicateJourneyError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!isUuid(id) || !(await deleteJourney(userId, id))) return notFound();
  return new Response(null, { status: 204 });
}

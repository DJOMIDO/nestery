// src/app/api/subscriptions/[id]/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteSubscription,
  updateSubscription,
  updateSubscriptionInput,
} from "@/server/subscriptions";
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
    updateSubscriptionInput,
    await request.json().catch(() => null)
  );
  if ("response" in input) return input.response;

  const subscription = await updateSubscription(userId, id, input.data);
  return subscription ? NextResponse.json(subscription) : notFound();
}

export async function DELETE(_request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!isUuid(id) || !(await deleteSubscription(userId, id))) return notFound();
  return new NextResponse(null, { status: 204 });
}

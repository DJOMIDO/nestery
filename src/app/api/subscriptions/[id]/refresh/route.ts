// src/app/api/subscriptions/[id]/refresh/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import { refreshSubscription } from "@/server/subscriptions";
import { getUserId, notFound, unauthorized } from "@/server/session";

type Context = { params: Promise<{ id: string }> };

// Fetches the feed now; the result reports lastError if that failed
export async function POST(_request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return notFound();

  const subscription = await refreshSubscription(userId, id);
  return subscription ? NextResponse.json(subscription) : notFound();
}

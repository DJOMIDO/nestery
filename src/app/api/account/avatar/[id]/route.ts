// src/app/api/account/avatar/[id]/route.ts
// The link kept as the user's image. Only its owner gets through, to a
// signed storage URL that is the same for an hour, so browsers cache it.

import { NextResponse } from "next/server";
import { z } from "zod";
import { avatarLink } from "@/server/avatar";
import { getUserId, notFound, unauthorized } from "@/server/session";
import { storageEnabled } from "@/server/storage";

type Context = { params: Promise<{ id: string }> };

// GET: redirects to the photo
export async function GET(_request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  if (!storageEnabled() || !z.string().uuid().safeParse(id).success) return notFound();

  return new NextResponse(null, {
    status: 302,
    headers: { Location: await avatarLink(userId, id), "Cache-Control": "private, max-age=1800" },
  });
}

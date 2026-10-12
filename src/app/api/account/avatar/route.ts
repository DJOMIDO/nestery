// src/app/api/account/avatar/route.ts

import { NextResponse } from "next/server";
import { createAvatarUpload, createAvatarUploadInput, removeAvatar } from "@/server/avatar";
import { errorResponse, getUserId, parseInput, unauthorized } from "@/server/session";
import { storageEnabled } from "@/server/storage";

// POST { contentType, size }: a signed URL the browser PUTs the photo to;
// then POST /api/account/avatar/[id]/complete
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  if (!storageEnabled()) {
    return await errorResponse("Photo uploads are not set up on this server.", 501);
  }

  const input = await parseInput(createAvatarUploadInput, await request.json().catch(() => null));
  if ("response" in input) return input.response;
  return NextResponse.json(await createAvatarUpload(userId, input.data), { status: 201 });
}

// DELETE: no photo, initials instead
export async function DELETE() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await removeAvatar(userId);
  return new Response(null, { status: 204 });
}

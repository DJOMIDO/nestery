// src/app/api/account/avatar/[id]/complete/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import { AttachmentError } from "@/server/attachments";
import { completeAvatarUpload } from "@/server/avatar";
import { errorResponse, getUserId, notFound, unauthorized } from "@/server/session";
import { storageEnabled } from "@/server/storage";

type Context = { params: Promise<{ id: string }> };

// POST: the browser finished uploading; the photo is checked and becomes the
// user's image ({ image })
export async function POST(_request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  if (!storageEnabled() || !z.string().uuid().safeParse(id).success) return notFound();

  try {
    return NextResponse.json(await completeAvatarUpload(userId, id));
  } catch (err) {
    if (err instanceof AttachmentError) return await errorResponse(err.message, err.status);
    throw err;
  }
}

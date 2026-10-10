// src/app/api/attachments/[id]/complete/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import { AttachmentError, completeUpload } from "@/server/attachments";
import { getUserId, notFound, unauthorized } from "@/server/session";

type Context = { params: Promise<{ id: string }> };

// POST: the browser finished uploading; the file is checked and kept
export async function POST(_request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return notFound();

  try {
    return NextResponse.json(await completeUpload(userId, id));
  } catch (err) {
    if (err instanceof AttachmentError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

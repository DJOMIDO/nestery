// src/app/api/notes/[id]/attachments/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import { AttachmentError, createUpload, createUploadInput, listNoteAttachments } from "@/server/attachments";
import { getUserId, notFound, parseInput, unauthorized } from "@/server/session";
import { storageEnabled } from "@/server/storage";

type Context = { params: Promise<{ id: string }> };

const isUuid = (id: string) => z.string().uuid().safeParse(id).success;

// GET: the note's files
export async function GET(_request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  return NextResponse.json(storageEnabled() ? await listNoteAttachments(userId, id) : []);
}

// POST { fileName, contentType, size }: a record for a new file and a signed
// URL the browser PUTs it to; then POST /api/attachments/[id]/complete
export async function POST(request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  if (!storageEnabled()) {
    return NextResponse.json({ error: "Attachments are not set up on this server." }, { status: 501 });
  }
  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const input = await parseInput(createUploadInput, await request.json().catch(() => null));
  if ("response" in input) return input.response;

  try {
    return NextResponse.json(await createUpload(userId, id, input.data), { status: 201 });
  } catch (err) {
    if (err instanceof AttachmentError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

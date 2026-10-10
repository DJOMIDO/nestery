// src/app/api/attachments/[id]/route.ts
// The link notes keep for a file. Only its owner gets through, to a signed
// storage URL that is the same for an hour, so browsers cache images.

import { NextResponse } from "next/server";
import { z } from "zod";
import { attachmentLink, deleteAttachment } from "@/server/attachments";
import { getUserId, notFound, unauthorized } from "@/server/session";

type Context = { params: Promise<{ id: string }> };

const isUuid = (id: string) => z.string().uuid().safeParse(id).success;

// GET: redirects to the file (images and PDFs open, other files download,
// under their own name: both set when the file was uploaded)
export async function GET(_request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const url = await attachmentLink(userId, id);
  if (!url) return notFound();
  return new NextResponse(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "private, max-age=1800" },
  });
}

export async function DELETE(_request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  if (!isUuid(id) || !(await deleteAttachment(userId, id))) return notFound();
  return new Response(null, { status: 204 });
}

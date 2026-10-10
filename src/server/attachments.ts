// src/server/attachments.ts
// Files attached to notes. Uploads go straight from the browser to storage:
// the server creates the record and a signed upload link, then checks the
// file once the browser says it's done.
//
// A deleted note's files stay a day without a note, so Undo (which recreates
// the note) can claim them back; after that they are removed, unless some
// note still links to them.

import { and, eq, inArray, isNull, lt, or, sql, sum } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { noteAttachments, notes } from "@/db/schema";
import { attachmentIdsIn, MAX_ATTACHMENT_BYTES, MAX_USER_STORAGE_BYTES, opensInline } from "@/lib/attachments";
import { deleteStored, deleteStoredPrefix, downloadUrl, storedSize, uploadUrl } from "@/server/storage";

const DAY_MS = 24 * 60 * 60 * 1000;

export class AttachmentError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export const createUploadInput = z.object({
  fileName: z.string().trim().min(1).max(200),
  // Browsers leave it empty for unknown kinds
  contentType: z
    .string()
    .max(100)
    .regex(/^$|^[\w.+-]+\/[\w.+-]+$/, "Unknown file type")
    .transform((v) => v || "application/octet-stream"),
  size: z.number().int().min(1).max(MAX_ATTACHMENT_BYTES, `Files can be at most ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB`),
});

const publicColumns = {
  id: noteAttachments.id,
  noteId: noteAttachments.noteId,
  fileName: noteAttachments.fileName,
  contentType: noteAttachments.contentType,
  size: noteAttachments.size,
  createdAt: noteAttachments.createdAt,
};

// Files are kept per user, so removing an account removes them all
const keyFor = (userId: string, id: string) => `u/${userId}/${id}`;

async function usedBytes(userId: string) {
  const [row] = await db
    .select({ total: sum(noteAttachments.size) })
    .from(noteAttachments)
    .where(eq(noteAttachments.userId, userId));
  return Number(row?.total ?? 0);
}

// Step 1: a record for the file and where to upload it
export async function createUpload(userId: string, noteId: string, input: z.infer<typeof createUploadInput>) {
  const [note] = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
  if (!note) throw new AttachmentError("Note not found", 404);
  if ((await usedBytes(userId)) + input.size > MAX_USER_STORAGE_BYTES) {
    throw new AttachmentError("Your attachments have reached the 1 GB limit. Delete some files first.", 413);
  }

  const id = crypto.randomUUID();
  const storageKey = keyFor(userId, id);
  const [attachment] = await db
    .insert(noteAttachments)
    .values({ id, userId, noteId, storageKey, ...input })
    .returning(publicColumns);
  // Clear out what earlier deletions and abandoned uploads left behind
  await removeOrphans(userId).catch((err) => console.error("Attachment cleanup failed", err));
  const upload = await uploadUrl(storageKey, { ...input, inline: opensInline(input.contentType) });
  return { attachment, uploadUrl: upload.url, uploadHeaders: upload.headers };
}

// Step 2: the browser finished; check the file is there and within limits
export async function completeUpload(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(noteAttachments)
    .where(and(eq(noteAttachments.id, id), eq(noteAttachments.userId, userId)));
  if (!row) throw new AttachmentError("File not found", 404);
  const size = await storedSize(row.storageKey);
  if (size === null) throw new AttachmentError("The upload didn't arrive. Try again.");
  if (size > MAX_ATTACHMENT_BYTES) {
    await deleteStored(row.storageKey);
    await db.delete(noteAttachments).where(eq(noteAttachments.id, id));
    throw new AttachmentError("The file is larger than allowed.", 413);
  }
  const [attachment] = await db
    .update(noteAttachments)
    .set({ uploaded: true, size })
    .where(eq(noteAttachments.id, id))
    .returning(publicColumns);
  return attachment;
}

// A signed link to the file, for its owner
export async function attachmentLink(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(noteAttachments)
    .where(and(eq(noteAttachments.id, id), eq(noteAttachments.userId, userId), eq(noteAttachments.uploaded, true)));
  if (!row) return null;
  return downloadUrl(row.storageKey);
}

export async function listNoteAttachments(userId: string, noteId: string) {
  return db
    .select(publicColumns)
    .from(noteAttachments)
    .where(and(eq(noteAttachments.userId, userId), eq(noteAttachments.noteId, noteId), eq(noteAttachments.uploaded, true)))
    .orderBy(noteAttachments.createdAt);
}

export async function deleteAttachment(userId: string, id: string) {
  const [row] = await db
    .delete(noteAttachments)
    .where(and(eq(noteAttachments.id, id), eq(noteAttachments.userId, userId)))
    .returning({ storageKey: noteAttachments.storageKey });
  if (!row) return false;
  await deleteStored(row.storageKey).catch((err) => console.error("Deleting a stored file failed", err));
  return true;
}

// Before a note is deleted: its files wait a day for Undo
export async function releaseNoteAttachments(userId: string, noteId: string) {
  await db
    .update(noteAttachments)
    .set({ noteId: null, orphanedAt: new Date() })
    .where(and(eq(noteAttachments.userId, userId), eq(noteAttachments.noteId, noteId)));
}

// After a note is saved: files it links to that have no note are its own
// (e.g. a note restored with Undo, or an image copied from a deleted note)
export async function claimLinkedAttachments(userId: string, noteId: string, content: unknown) {
  const ids = attachmentIdsIn(content);
  if (!ids.length) return;
  await db
    .update(noteAttachments)
    .set({ noteId, orphanedAt: null })
    .where(and(eq(noteAttachments.userId, userId), inArray(noteAttachments.id, ids), isNull(noteAttachments.noteId)));
}

// Files without a note for a day, and uploads never finished: removed,
// unless one of the user's notes still links to the file
export async function removeOrphans(userId: string) {
  const dayAgo = new Date(Date.now() - DAY_MS);
  const stale = await db
    .select({ id: noteAttachments.id, storageKey: noteAttachments.storageKey })
    .from(noteAttachments)
    .where(
      and(
        eq(noteAttachments.userId, userId),
        or(
          and(isNull(noteAttachments.noteId), lt(noteAttachments.orphanedAt, dayAgo)),
          and(eq(noteAttachments.uploaded, false), lt(noteAttachments.createdAt, dayAgo))
        )
      )
    )
    .limit(50);

  for (const file of stale) {
    const [linking] = await db
      .select({ id: notes.id })
      .from(notes)
      .where(and(eq(notes.userId, userId), sql`${notes.content}::text like ${`%/api/attachments/${file.id}%`}`))
      .limit(1);
    if (linking) {
      await db
        .update(noteAttachments)
        .set({ noteId: linking.id, orphanedAt: null })
        .where(eq(noteAttachments.id, file.id));
      continue;
    }
    await deleteStored(file.storageKey).catch(() => {});
    await db.delete(noteAttachments).where(eq(noteAttachments.id, file.id));
  }
}

// When an account is deleted (its rows go with it)
export const deleteUserFiles = (userId: string) => deleteStoredPrefix(`u/${userId}/`);

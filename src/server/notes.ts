// src/server/notes.ts
// Note data access. Every function is scoped to the given user.

import { and, desc, eq, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db";
import { notes } from "@/db/schema";
import { EMPTY_NOTE_CONTENT, type NoteContent } from "@/lib/notes";

const MAX_CONTENT_BYTES = 1_000_000;

// Editor document; the editor owns its inner structure, so only the root and size are checked
const noteContent = z
  .object({ type: z.literal("doc") })
  .passthrough()
  .refine(
    (doc) => JSON.stringify(doc).length <= MAX_CONTENT_BYTES,
    "Note is too large"
  )
  .transform((doc) => doc as NoteContent);

const noteFields = {
  title: z.string().max(200, "Title must be at most 200 characters"),
  content: noteContent,
  contentText: z.string().max(MAX_CONTENT_BYTES, "Note is too large"),
  pinned: z.boolean(),
};

export const createNoteInput = z.object({
  title: noteFields.title.default(""),
  content: noteFields.content.default(EMPTY_NOTE_CONTENT),
  contentText: noteFields.contentText.default(""),
  pinned: noteFields.pinned.default(false),
});

export const updateNoteInput = z
  .object(noteFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export type CreateNoteInput = z.infer<typeof createNoteInput>;
export type UpdateNoteInput = z.infer<typeof updateNoteInput>;

export async function listNotes(userId: string) {
  return db
    .select()
    .from(notes)
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.pinned), desc(notes.updatedAt));
}

export async function getNote(userId: string, id: string) {
  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)));
  return note ?? null;
}

export async function createNote(userId: string, input: CreateNoteInput) {
  const [note] = await db
    .insert(notes)
    .values({ userId, ...input })
    .returning();
  return note;
}

// Returns null when the note does not exist or belongs to another user
export async function updateNote(
  userId: string,
  id: string,
  input: UpdateNoteInput
) {
  const values: PgUpdateSetSource<typeof notes> = { ...input };
  // Pinning is not an edit, so keep the "last edited" time
  const onlyPinned = Object.keys(input).every((key) => key === "pinned");
  if (onlyPinned) values.updatedAt = sql`${notes.updatedAt}`;

  const [updated] = await db
    .update(notes)
    .set(values)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .returning();
  return updated ?? null;
}

// Returns false when the note does not exist or belongs to another user
export async function deleteNote(userId: string, id: string) {
  const deleted = await db
    .delete(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .returning({ id: notes.id });
  return deleted.length > 0;
}

// src/server/notes.ts
// Note data access. Every function is scoped to the given user.

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db";
import { notes } from "@/db/schema";
import { EMPTY_NOTE_CONTENT, type NoteContent } from "@/lib/notes";
import { MAX_SPLIT_PARTS, noteText, splitNoteContent } from "@/lib/noteSplit";
import { claimLinkedAttachments, moveAttachments, releaseNoteAttachments } from "@/server/attachments";
import { tagList } from "@/server/tags";

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
  tags: tagList,
};

export const createNoteInput = z.object({
  title: noteFields.title.default(""),
  content: noteFields.content.default(EMPTY_NOTE_CONTENT),
  contentText: noteFields.contentText.default(""),
  pinned: noteFields.pinned.default(false),
  tags: noteFields.tags.default([]),
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
  // A note restored with Undo takes its files back
  await claimLinkedAttachments(userId, note.id, note.content);
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
  if (updated && input.content) await claimLinkedAttachments(userId, id, input.content);
  return updated ?? null;
}

export const splitNoteInput = z
  .object({
    headingLevel: z.number().int().min(1).max(3).optional(),
    lineStartsWith: z.string().trim().min(1).max(100).optional(),
    // One per new note, in order
    titles: z.array(noteFields.title).min(1).max(MAX_SPLIT_PARTS),
    // The note as it was when the split was proposed; a note edited since
    // is not split
    expectedUpdatedAt: z.string().datetime({ offset: true }),
  })
  .refine((v) => !!v.headingLevel !== !!v.lineStartsWith, "Give either a heading level or the text that starts each part");

export type SplitNoteInput = z.infer<typeof splitNoteInput>;

// Moves each part of a note after the first into a note of its own, with the
// original's tags. Returns null when the note does not exist; throws
// SplitError with a message for the user when it can't be split as asked.
export async function splitNote(userId: string, id: string, input: SplitNoteInput) {
  const note = await getNote(userId, id);
  if (!note) return null;
  if (note.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()) {
    throw new SplitError("The note was edited after the split was proposed. Ask the assistant again.");
  }
  let split;
  try {
    split = splitNoteContent(note.content, input);
  } catch (err) {
    throw new SplitError((err as Error).message);
  }
  if (split.parts.length !== input.titles.length) {
    throw new SplitError("The note was edited after the split was proposed. Ask the assistant again.");
  }

  const created = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(notes)
      .values(
        split.parts.map((part, i) => ({
          userId,
          title: input.titles[i],
          content: part.content,
          contentText: noteText(part.content),
          tags: note.tags,
        }))
      )
      .returning({ id: notes.id, content: notes.content });
    await tx
      .update(notes)
      .set({ content: split.kept, contentText: noteText(split.kept) })
      .where(and(eq(notes.id, id), eq(notes.userId, userId)));
    return rows;
  });
  // Files shown in a part now belong to its note
  for (const row of created) await moveAttachments(userId, id, row.id, row.content);
  return { created: created.length };
}

export class SplitError extends Error {}

// Returns false when the note does not exist or belongs to another user
export async function deleteNote(userId: string, id: string) {
  // Its files wait a day, so Undo can bring them back with the note
  await releaseNoteAttachments(userId, id);
  const deleted = await db
    .delete(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .returning({ id: notes.id });
  return deleted.length > 0;
}

// Notes containing every word of `query` in the title, text or tags (any
// case; "#trip" finds the tag trip), most recently edited first
export async function searchNotes(userId: string, query: string, limit = 10) {
  const words = query
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/^#+/, ""))
    .filter(Boolean)
    .slice(0, 5);
  const escape = (word: string) => `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        ...words.map((word) =>
          or(
            ilike(notes.title, escape(word)),
            ilike(notes.contentText, escape(word)),
            ilike(sql`array_to_string(${notes.tags}, ' ')`, escape(word))
          )
        )
      )
    )
    .orderBy(desc(notes.updatedAt))
    .limit(limit);
}

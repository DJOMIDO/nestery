// src/lib/notes.ts
// Note types and helpers shared by the server and the notes page.
// Keep this file free of server-only imports so client components can use it.

import type { JSONContent } from "@tiptap/react";

// Editor document as stored in notes.content
export type NoteContent = JSONContent & { type: "doc" };

export const EMPTY_NOTE_CONTENT: NoteContent = { type: "doc", content: [] };

// A note as returned by /api/notes
export interface Note {
  id: string;
  userId: string;
  title: string;
  content: NoteContent;
  contentText: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export const noteTitle = (note: Pick<Note, "title">) =>
  note.title.trim() || "Untitled";

// First non-empty line of the body, for the list
export function notePreview(note: Pick<Note, "contentText">) {
  const line = note.contentText.split("\n").find((l) => l.trim());
  return line?.trim() ?? "No additional text";
}

// Pinned first, then most recently edited
export function compareNotes(a: Note, b: Note) {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return b.updatedAt.localeCompare(a.updatedAt);
}

export function matchesQuery(note: Note, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    note.title.toLowerCase().includes(q) ||
    note.contentText.toLowerCase().includes(q)
  );
}

export interface NoteActivity {
  id: string;
  kind: "created" | "edited";
  noteId: string;
  title: string;
  at: string; // ISO timestamp
}

// Edits within this long of creation count as part of creating the note
const EDIT_GRACE_MS = 60_000;

// Recent note events, newest first: one "created" per note, plus its latest
// edit. Derived from createdAt / updatedAt, so deleted notes do not appear.
export function noteActivity(notes: Note[], limit = 10): NoteActivity[] {
  const events: NoteActivity[] = [];
  for (const note of notes) {
    const title = noteTitle(note);
    events.push({ id: `${note.id}-created`, kind: "created", noteId: note.id, title, at: note.createdAt });
    const editedLater =
      new Date(note.updatedAt).getTime() - new Date(note.createdAt).getTime() > EDIT_GRACE_MS;
    if (editedLater) {
      events.push({ id: `${note.id}-edited`, kind: "edited", noteId: note.id, title, at: note.updatedAt });
    }
  }
  return events.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
}

// Link that opens a note on the notes page
export const noteHref = (id: string) => `/notes?note=${id}`;

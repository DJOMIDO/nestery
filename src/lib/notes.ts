// src/lib/notes.ts
// Note types and helpers shared by the server and the notes page.
// Keep this file free of server-only imports so client components can use it.

import type { JSONContent } from "@tiptap/react";
import { isAttachmentHref } from "@/lib/attachments";

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

const TEXT_BLOCKS = new Set(["paragraph", "heading", "codeBlock"]);

// The paragraphs, headings and code blocks of a document, in order (also
// those inside lists, quotes and tables)
function* textBlocks(node: JSONContent): Generator<JSONContent> {
  if (node.type && TEXT_BLOCKS.has(node.type)) yield node;
  else for (const child of node.content ?? []) yield* textBlocks(child);
}

// First non-empty line of the body, for the list. `file` is set when that
// line is an attached file's link, so it can show a paperclip.
export function notePreview(note: Pick<Note, "content">): { text: string; file: boolean } {
  for (const block of textBlocks(note.content)) {
    const parts = (block.content ?? []).filter((n) => n.type === "text" && n.text?.trim());
    // Older notes put a 📎 before the file's name
    const text = parts.map((n) => n.text).join("").replace(/^📎 /, "").split("\n")[0].trim();
    if (!text) continue;
    const file = parts.every((n) => n.marks?.some((m) => m.type === "link" && isAttachmentHref(m.attrs?.href)));
    return { text, file };
  }
  return { text: "No additional text", file: false };
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

// src/components/notes/extensions.ts
// Tiptap extensions used by the note editor.

import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { MarkdownPaste } from "@/components/notes/markdownPaste";

export const noteExtensions = [
  StarterKit.configure({
    // Links open with Cmd/Ctrl+click (see NoteEditor), so a plain click just places the cursor
    link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
  }),
  // "[ ] " or "[x] " at the start of a line starts a checklist
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit.configure({ table: { resizable: false } }),
  // "==text==" highlights
  Highlight,
  // Attached images, as /api/attachments/<id> (never data: URLs)
  Image.configure({ allowBase64: false, HTMLAttributes: { class: "note-image", loading: "lazy" } }),
  Placeholder.configure({ placeholder: "Start writing…" }),
  // Markdown in and out: source view, import/export, and pasting Markdown text
  Markdown,
  MarkdownPaste,
];

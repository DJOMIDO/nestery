// src/components/notes/markdown.ts
// Markdown import/export for notes. Client-only (uses the editor and the DOM).

import { Editor, type JSONContent } from "@tiptap/react";
import { noteExtensions } from "@/components/notes/extensions";
import type { NoteContent } from "@/lib/notes";

const textOf = (node: JSONContent): string =>
  node.text ?? (node.content ?? []).map(textOf).join("");

// Parses a Markdown file into note fields. A leading "# Heading" becomes the
// title (the inverse of noteToMarkdown); otherwise the file name is used.
export function markdownToNote(markdown: string, fileName: string) {
  // A throwaway headless editor with the note extensions, so imported notes
  // match what the editor itself produces
  const editor = new Editor({
    extensions: noteExtensions,
    content: markdown,
    contentType: "markdown",
  });
  try {
    const doc = editor.getJSON() as NoteContent;
    const [first, ...rest] = doc.content ?? [];
    const hasTitle = first?.type === "heading" && first.attrs?.level === 1;
    if (hasTitle) editor.commands.setContent({ type: "doc", content: rest });

    return {
      title: hasTitle
        ? textOf(first).trim()
        : fileName.replace(/\.(md|markdown|txt)$/i, "").trim(),
      content: editor.getJSON() as NoteContent,
      contentText: editor.getText({ blockSeparator: "\n" }),
    };
  } finally {
    editor.destroy();
  }
}

// The note as a Markdown document, with its title as the top heading
export function noteToMarkdown(title: string, body: string) {
  const heading = title.trim();
  return heading ? `# ${heading}\n\n${body}` : body;
}

export function downloadMarkdown(title: string, markdown: string) {
  const name = title.trim().replace(/[\\/:*?"<>|]+/g, "-") || "Untitled";
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

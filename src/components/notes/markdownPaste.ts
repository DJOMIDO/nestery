// src/components/notes/markdownPaste.ts
// Converts pasted Markdown into formatted content.

import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";

// Rough check for plain text that is meant as Markdown
const MARKDOWN_PATTERNS = [
  /^#{1,6}\s/m, // heading
  /^\s*[-*+]\s/m, // bullet list
  /^\s*\d+[.)]\s/m, // numbered list
  /^>\s/m, // quote
  /^```/m, // code fence
  /^\|.+\|\s*$/m, // table row
  /\*\*[^*\n]+\*\*/, // bold
  /~~[^~\n]+~~/, // strikethrough
  /==[^=\n]+==/, // highlight
  /\[[^\]\n]+\]\([^)\s]+\)/, // link
];

export const looksLikeMarkdown = (text: string) =>
  MARKDOWN_PATTERNS.some((pattern) => pattern.test(text));

// Tags that mean the clipboard HTML already carries real formatting
const SEMANTIC_HTML = /<(h[1-6]|ul|ol|li|strong|b|em|i|table|a|blockquote|pre)[\s>]/i;

export const MarkdownPaste = Extension.create({
  name: "markdownPaste",

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("markdownPaste"),
        props: {
          handlePaste: (_view, event) => {
            const data = event.clipboardData;
            const text = data?.getData("text/plain");
            if (!text || !looksLikeMarkdown(text) || editor.isActive("codeBlock")) return false;
            // Rich content from web pages or docs keeps its own formatting. Code
            // editors (e.g. VS Code) also send HTML, but only colored spans.
            const html = data?.getData("text/html");
            if (html && SEMANTIC_HTML.test(html)) return false;

            editor.commands.insertContent(text, { contentType: "markdown" });
            return true;
          },
        },
      }),
    ];
  },
});

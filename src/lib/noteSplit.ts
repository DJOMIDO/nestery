// src/lib/noteSplit.ts
// Splitting one note into several, at its headings or at lines that start
// with a given text (e.g. "File:"). Works on the editor document itself, so
// formatting, code blocks and images move unchanged. Shared by the server
// (which does the split) and the assistant's tools (which preview it).

import type { JSONContent } from "@tiptap/react";
import type { NoteContent } from "@/lib/notes";

// Exactly one of the two
export interface NoteSplitRule {
  // Each heading of this level starts a part
  headingLevel?: number;
  // Each line starting with this text (any case) starts a part
  lineStartsWith?: string;
}

export interface NoteSplit {
  // What stays in the original note
  kept: NoteContent;
  // Each new note: the heading line (title by default) and its body
  parts: { heading: string; content: NoteContent }[];
}

export const MAX_SPLIT_PARTS = 100;

// One top-level block, or one line of a block cut at its line breaks
interface Unit {
  node: JSONContent;
  text: string;
  marker: boolean;
}

const inlineText = (nodes: JSONContent[] = []) =>
  nodes.map((n) => (n.type === "hardBreak" ? "\n" : (n.text ?? ""))).join("");

const TEXT_BLOCKS = new Set(["paragraph", "heading", "codeBlock"]);

const blockText = (node: JSONContent): string =>
  TEXT_BLOCKS.has(node.type ?? "") ? inlineText(node.content) : (node.content ?? []).map(blockText).join("\n");

// The document's plain text, close to the editor's getText({ blockSeparator: "\n" })
export function noteText(doc: JSONContent): string {
  return blockText(doc);
}

// A line of only ===, ---, *** and the like, often drawn around a part's heading
const isRule = (text: string) => /^[=\-_*~#]{3,}$/.test(text.trim());

function isMarker(node: JSONContent, text: string, rule: NoteSplitRule) {
  if (rule.headingLevel) return node.type === "heading" && node.attrs?.level === rule.headingLevel;
  const start = rule.lineStartsWith!.trim().toLowerCase();
  return text.trim().toLowerCase().startsWith(start);
}

// Cuts a paragraph, heading or code block into one unit per line, but only
// when one of its lines starts a part (pasted text often keeps many lines in
// one block)
function units(node: JSONContent, rule: NoteSplitRule): Unit[] {
  const text = blockText(node);
  // A line-start rule looks at single lines; the lines of a longer block are cut below
  const whole = { node, text, marker: (!!rule.headingLevel || !text.includes("\n")) && isMarker(node, text, rule) };
  if (!rule.lineStartsWith || !whole.text.includes("\n")) return [whole];
  const lines = whole.text.split("\n");
  if (!lines.some((line) => isMarker(node, line, rule))) return [whole];

  if (node.type === "codeBlock") {
    // Runs of ordinary lines stay code; marker and rule lines become paragraphs
    const out: Unit[] = [];
    let run: string[] = [];
    // Blank lines around the cuts are dropped rather than kept as empty code
    const flush = () => {
      const text = run.join("\n").replace(/^\s*\n|\n\s*$/g, "");
      if (text.trim()) out.push({ node: { ...node, content: [{ type: "text", text }] }, text, marker: false });
      run = [];
    };
    for (const line of lines) {
      if (isMarker(node, line, rule) || isRule(line)) {
        flush();
        out.push({ node: paragraph(line), text: line, marker: isMarker(node, line, rule) });
      } else run.push(line);
    }
    flush();
    return out;
  }

  // Paragraphs and headings: split at their hard breaks, keeping marks
  const out: Unit[] = [];
  let current: JSONContent[] = [];
  const push = () => {
    const text = inlineText(current);
    const piece = { ...node, content: current.length ? current : undefined };
    out.push({ node: piece, text, marker: isMarker(node, text, rule) });
    current = [];
  };
  for (const child of node.content ?? []) {
    if (child.type === "hardBreak") push();
    else current.push(child);
  }
  push();
  return out;
}

const paragraph = (text: string): JSONContent =>
  text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };

const isBlank = (unit: Unit) => !unit.text.trim() && !hasMedia(unit.node);
const hasMedia = (node: JSONContent): boolean =>
  node.type === "image" || node.type === "table" || (node.content ?? []).some(hasMedia);

// Drops blank units at both ends
function trim(list: Unit[]) {
  let start = 0;
  let end = list.length;
  while (start < end && isBlank(list[start])) start++;
  while (end > start && isBlank(list[end - 1])) end--;
  return list.slice(start, end);
}

const doc = (list: Unit[]): NoteContent => ({ type: "doc", content: trim(list).map((u) => u.node) });

// Splits `content` by `rule`. The original keeps whatever comes before the
// first part; when that is empty (the note opens with a part), it keeps the
// first part instead. Throws with a message for the user (or the model) when
// the note can't be split.
export function splitNoteContent(content: NoteContent, rule: NoteSplitRule): NoteSplit {
  if (!!rule.headingLevel === !!rule.lineStartsWith?.trim()) {
    throw new Error("Give either a heading level or the text that starts each part");
  }
  const list = (content.content ?? []).flatMap((node) => units(node, rule));
  const markers = list.flatMap((u, i) => (u.marker ? [i] : []));

  // A part's heading area: its marker line plus the rule and blank lines
  // just before and after it, which are left out of the notes
  const areas = markers.map((m) => {
    let start = m;
    while (start > 0 && (isRule(list[start - 1].text) || isBlank(list[start - 1]))) start--;
    let end = m + 1;
    while (end < list.length && (isRule(list[end].text) || isBlank(list[end])) && !list[end].marker) end++;
    return { start, marker: m, end };
  });

  const before = list.slice(0, areas[0]?.start ?? list.length);
  const keepFirst = !trim(before).length;
  const moved = keepFirst ? areas.slice(1) : areas;
  if (!moved.length) {
    throw new Error(
      markers.length ? "The note has only one part, so there is nothing to split" : "No part of the note starts that way"
    );
  }
  if (moved.length > MAX_SPLIT_PARTS) throw new Error(`Split into at most ${MAX_SPLIT_PARTS} notes at a time`);

  return {
    kept: doc(list.slice(0, moved[0].start)),
    parts: moved.map((area, i) => ({
      heading: list[area.marker].text.replace(/\s+/g, " ").trim(),
      content: doc(list.slice(area.end, moved[i + 1]?.start ?? list.length)),
    })),
  };
}

// src/components/notes/SlashMenu.tsx
// Type "/" at the start of a line to insert a block: headings, lists, a
// checklist, a quote, code, a table, a divider or an attachment. Typing on
// filters the list (in English or the interface language); arrows and
// Enter pick, Escape closes. A "/" that isn't a command stays text: the
// menu goes away once nothing matches ("/你好", "1/2"), and Enter right
// after a lone "/" starts a new line. Built on Tiptap's suggestion plugin, which
// tracks the typed text and positions the menu at the cursor.
"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Extension, type Editor, type Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import { PluginKey } from "@tiptap/pm/state";
import { Suggestion, exitSuggestion, type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Paperclip,
  Pilcrow,
  Quote,
  SquareCode,
  Table,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type messages from "@/i18n/messages/en.json";

type Label = keyof (typeof messages)["notes"]["toolbar"] | "divider";

interface SlashItem {
  // Its name in messages (notes.toolbar.<label>, or notes.slash.divider)
  label: Label;
  icon: LucideIcon;
  // Other words it is found by, in each language
  keywords: string[];
  // The Markdown that does the same, shown as a hint
  markdown?: string;
  run: (editor: Editor, range: Range) => void;
}

const ITEMS: SlashItem[] = [
  { label: "text", icon: Pilcrow, keywords: ["paragraph", "p", "正文", "文本", "段落", "texte"], run: (e, r) => e.chain().focus().deleteRange(r).clearNodes().run() },
  { label: "heading1", icon: Heading1, markdown: "#", keywords: ["h1", "title", "标题", "標題", "titre"], run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run() },
  { label: "heading2", icon: Heading2, markdown: "##", keywords: ["h2", "subtitle", "标题", "標題", "titre"], run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run() },
  { label: "heading3", icon: Heading3, markdown: "###", keywords: ["h3", "标题", "標題", "titre"], run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run() },
  { label: "bulletList", icon: List, markdown: "-", keywords: ["ul", "list", "bullet", "列表", "無序", "无序", "liste", "puces"], run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { label: "numberedList", icon: ListOrdered, markdown: "1.", keywords: ["ol", "list", "number", "ordered", "列表", "有序", "编号", "編號", "liste", "numérotée"], run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { label: "checklist", icon: ListChecks, markdown: "[ ]", keywords: ["todo", "task", "checkbox", "待办", "待辦", "清单", "清單", "任务", "任務", "tâches", "cases"], run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
  { label: "quote", icon: Quote, markdown: ">", keywords: ["blockquote", "引用", "citation"], run: (e, r) => e.chain().focus().deleteRange(r).clearNodes().toggleBlockquote().run() },
  { label: "codeBlock", icon: SquareCode, markdown: "```", keywords: ["code", "pre", "代码", "代碼", "程式"], run: (e, r) => e.chain().focus().deleteRange(r).setCodeBlock().run() },
  { label: "insertTable", icon: Table, keywords: ["table", "grid", "表格", "tableau"], run: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { label: "divider", icon: Minus, markdown: "---", keywords: ["hr", "rule", "line", "separator", "分割线", "分隔線", "分割", "séparateur", "ligne"], run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
];

const ATTACH: SlashItem = {
  label: "attach",
  icon: Paperclip,
  keywords: ["image", "file", "photo", "upload", "图片", "圖片", "文件", "檔案", "附件", "fichier"],
  // Replaced per editor: picking files lives in NoteEditor
  run: () => {},
};

// "Heading 1" -> "heading1": spaces and case don't matter when filtering
const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, "");

export interface SlashMenuHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

interface SlashMenuProps {
  query: string;
  items: SlashItem[];
  onPick: (item: SlashItem) => void;
  // Closes the menu, keeping what was typed
  onDismiss: () => void;
}

const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(function SlashMenu({ query, items, onPick, onDismiss }, ref) {
  const t = useTranslations("notes");
  const name = (item: SlashItem) => (item.label === "divider" ? t("slash.divider") : t(`toolbar.${item.label}`));
  // Names or words starting with what was typed come first ("/h": the
  // headings), then those that only contain it ("/表": 列表 after 表格)
  const q = normalize(query);
  const score = (item: SlashItem) => {
    const words = [name(item), item.label, ...item.keywords].map(normalize);
    return words.some((w) => w.startsWith(q)) ? 0 : words.some((w) => w.includes(q)) ? 1 : -1;
  };
  const shown = q
    ? items
        .map((item) => [score(item), item] as const)
        .filter(([s]) => s >= 0)
        .sort((a, b) => a[0] - b[0])
        .map(([, item]) => item)
    : items;
  const [active, setActive] = useState(0);
  // Moved with the arrows since the last keystroke
  const [moved, setMoved] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const noMatch = !!q && shown.length === 0;

  // A new filter starts from the top
  useEffect(() => {
    setActive(0);
    setMoved(false);
  }, [query]);
  // Nothing matches: it was just text with a "/", so the menu goes away and
  // stays away until the next "/"
  useEffect(() => {
    if (noMatch) onDismiss();
  }, [noMatch, onDismiss]);
  // Keep the highlighted item in view while moving with the arrows
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!shown.length) return false;
      if (event.key === "ArrowDown") {
        setActive((i) => (i + 1) % shown.length);
        setMoved(true);
        return true;
      }
      if (event.key === "ArrowUp") {
        setActive((i) => (i - 1 + shown.length) % shown.length);
        setMoved(true);
        return true;
      }
      // Enter after a lone "/" is a new line, unless an item was chosen
      if (event.key === "Enter" && !q && !moved) {
        onDismiss();
        return false;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        onPick(shown[Math.min(active, shown.length - 1)]);
        return true;
      }
      return false;
    },
  }));

  if (noMatch) return null;

  return (
    <div
      ref={list}
      role="listbox"
      aria-label={t("slash.label")}
      className="z-50 max-h-72 w-60 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
    >
      {shown.map((item, i) => (
          <button
            key={item.label}
            type="button"
            role="option"
            aria-selected={i === active}
            data-index={i}
            // Keep the text's focus, so the command applies where "/" was typed
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => onPick(item)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm",
              i === active && "bg-leaf-soft text-leaf"
            )}
          >
            <item.icon className="size-4 shrink-0" />
            <span className="flex-1 truncate">{name(item)}</span>
            {item.markdown && <kbd className="font-mono text-xs text-muted-foreground">{item.markdown}</kbd>}
          </button>
      ))}
    </div>
  );
});

// The "/" menu for the note editor. `onAttach` picks files to attach; leave
// it out where attachments aren't available.
export const SlashCommand = Extension.create<{ onAttach?: () => (() => void) | undefined }>({
  name: "slashCommand",

  addOptions() {
    return { onAttach: undefined };
  },

  addProseMirrorPlugins() {
    const attach = this.options.onAttach;
    const pluginKey = new PluginKey("slashCommand");
    const items = () => {
      const pick = attach?.();
      return pick ? [...ITEMS, { ...ATTACH, run: (e: Editor, r: Range) => (e.chain().focus().deleteRange(r).run(), pick()) }] : ITEMS;
    };

    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        pluginKey,
        char: "/",
        // Only at the start of a line, and never inside code, where "/" is
        // just a character
        startOfLine: true,
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          return $from.parent.type.name !== "codeBlock";
        },
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let renderer: ReactRenderer<SlashMenuHandle, SlashMenuProps> | null = null;
          let unmount: (() => void) | null = null;
          const propsOf = (p: SuggestionProps<SlashItem, SlashItem>): SlashMenuProps => ({
            query: p.query,
            items: items(),
            onPick: (item) => p.command(item),
            onDismiss: dismiss,
          });
          // Stable, so the menu's effect doesn't run on every keystroke
          const dismiss = () => exitSuggestion(this.editor.view, pluginKey);
          return {
            onStart: (p) => {
              renderer = new ReactRenderer(SlashMenu, { props: propsOf(p), editor: p.editor });
              // The plugin keeps it at the cursor, flipping at the screen's edges
              unmount = p.mount(renderer.element as HTMLElement);
            },
            onUpdate: (p) => renderer?.updateProps(propsOf(p)),
            onKeyDown: (p) => {
              if (p.event.key === "Escape") return false;
              return renderer?.ref?.onKeyDown(p) ?? false;
            },
            onExit: () => {
              unmount?.();
              renderer?.destroy();
              renderer = null;
              unmount = null;
            },
          };
        },
      }),
    ];
  },
});

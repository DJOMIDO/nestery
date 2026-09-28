// src/components/notes/NoteToolbar.tsx
"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Quote,
  SquareCode,
  Strikethrough,
  Underline,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ToolbarAction {
  label: string;
  icon: LucideIcon;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

// Grouped; groups are separated by a divider
const GROUPS: ToolbarAction[][] = [
  [
    { label: "Bold", icon: Bold, isActive: (e) => e.isActive("bold"), run: (e) => e.chain().focus().toggleBold().run() },
    { label: "Italic", icon: Italic, isActive: (e) => e.isActive("italic"), run: (e) => e.chain().focus().toggleItalic().run() },
    { label: "Underline", icon: Underline, isActive: (e) => e.isActive("underline"), run: (e) => e.chain().focus().toggleUnderline().run() },
    { label: "Strikethrough", icon: Strikethrough, isActive: (e) => e.isActive("strike"), run: (e) => e.chain().focus().toggleStrike().run() },
  ],
  [
    { label: "Heading 1", icon: Heading1, isActive: (e) => e.isActive("heading", { level: 1 }), run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: "Heading 2", icon: Heading2, isActive: (e) => e.isActive("heading", { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  ],
  [
    { label: "Bullet list", icon: List, isActive: (e) => e.isActive("bulletList"), run: (e) => e.chain().focus().toggleBulletList().run() },
    { label: "Numbered list", icon: ListOrdered, isActive: (e) => e.isActive("orderedList"), run: (e) => e.chain().focus().toggleOrderedList().run() },
  ],
  [
    { label: "Quote", icon: Quote, isActive: (e) => e.isActive("blockquote"), run: (e) => e.chain().focus().toggleBlockquote().run() },
    { label: "Inline code", icon: Code, isActive: (e) => e.isActive("code"), run: (e) => e.chain().focus().toggleCode().run() },
    { label: "Code block", icon: SquareCode, isActive: (e) => e.isActive("codeBlock"), run: (e) => e.chain().focus().toggleCodeBlock().run() },
  ],
];

const ACTIONS = GROUPS.flat();

export function NoteToolbar({ editor }: { editor: Editor }) {
  // Re-render only when an action's active state changes, not on every keystroke
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ACTIONS.map((a) => a.isActive(editor)),
  });

  let index = 0;
  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5">
      {GROUPS.map((group, g) => (
        <div key={g} className="flex items-center gap-0.5">
          {g > 0 && <div className="mx-1 h-5 w-px bg-border" aria-hidden />}
          {group.map((action) => {
            const isActive = active[index++];
            const Icon = action.icon;
            return (
              <Button
                key={action.label}
                type="button"
                variant="ghost"
                size="icon"
                className={cn("size-8", isActive && "bg-leaf-soft text-leaf hover:bg-leaf-soft hover:text-leaf")}
                onClick={() => action.run(editor)}
                aria-label={action.label}
                aria-pressed={isActive}
                title={action.label}
              >
                <Icon className="w-4 h-4" />
              </Button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

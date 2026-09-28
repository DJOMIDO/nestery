// src/components/notes/NoteBubbleMenu.tsx
"use client";

import { useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Bold,
  Check,
  ExternalLink,
  Highlighter,
  Italic,
  Link2,
  Pencil,
  Strikethrough,
  Unlink,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// "example.com" -> "https://example.com"; leaves full URLs, mailto:, / and # links alone
export function normalizeUrl(input: string) {
  const url = input.trim();
  if (!url || /^[a-z][a-z\d+.-]*:/i.test(url) || /^[/#]/.test(url)) return url;
  return `https://${url}`;
}

// Applies the link to the selection (or the whole link under the cursor);
// an empty URL removes it
export function applyLink(editor: Editor, input: string) {
  const href = normalizeUrl(input);
  const chain = editor.chain().focus().extendMarkRange("link");
  if (href) chain.setLink({ href }).run();
  else chain.unsetLink().run();
}

interface NoteBubbleMenuProps {
  editor: Editor;
  linkEditing: boolean;
  onLinkEditingChange: (editing: boolean) => void;
  scrollTarget?: HTMLElement | null;
}

// Floating menu over a text selection (quick formatting), or over a link under
// the cursor (open / edit / remove)
export function NoteBubbleMenu({
  editor,
  linkEditing,
  onLinkEditingChange,
  scrollTarget,
}: NoteBubbleMenuProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      empty: editor.state.selection.empty,
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      strike: editor.isActive("strike"),
      highlight: editor.isActive("highlight"),
      link: editor.isActive("link"),
      href: (editor.getAttributes("link").href as string | undefined) ?? "",
    }),
  });

  const marks: { label: string; icon: LucideIcon; active: boolean; run: () => void }[] = [
    { label: "Bold", icon: Bold, active: state.bold, run: () => editor.chain().focus().toggleBold().run() },
    { label: "Italic", icon: Italic, active: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { label: "Strikethrough", icon: Strikethrough, active: state.strike, run: () => editor.chain().focus().toggleStrike().run() },
    { label: "Highlight", icon: Highlighter, active: state.highlight, run: () => editor.chain().focus().toggleHighlight().run() },
  ];

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 8, flip: true, shift: { padding: 8 }, scrollTarget: scrollTarget ?? undefined }}
      shouldShow={({ editor, view, element, from, to }) => {
        const focused = view.hasFocus() || element.contains(document.activeElement);
        if (!focused || !editor.isEditable || editor.isActive("codeBlock")) return false;
        return from !== to || editor.isActive("link");
      }}
      className="z-40 flex items-center gap-0.5 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
    >
      {linkEditing ? (
        <LinkForm
          initialUrl={state.href}
          onSubmit={(url) => {
            applyLink(editor, url);
            onLinkEditingChange(false);
          }}
          onCancel={() => {
            onLinkEditingChange(false);
            editor.commands.focus();
          }}
        />
      ) : state.empty && state.link ? (
        // Cursor inside a link
        <>
          <a
            href={state.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex max-w-56 items-center gap-1 truncate px-2 text-sm text-leaf underline underline-offset-2"
            title={state.href}
          >
            <span className="truncate">{state.href}</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </a>
          <MenuButton label="Edit link" icon={Pencil} onClick={() => onLinkEditingChange(true)} />
          <MenuButton
            label="Remove link"
            icon={Unlink}
            onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
          />
        </>
      ) : (
        <>
          {marks.map((m) => (
            <MenuButton key={m.label} label={m.label} icon={m.icon} active={m.active} onClick={m.run} />
          ))}
          <div className="mx-1 h-5 w-px bg-border" aria-hidden />
          <MenuButton label="Link" icon={Link2} active={state.link} onClick={() => onLinkEditingChange(true)} />
        </>
      )}
    </BubbleMenu>
  );
}

function MenuButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-7", active && "bg-leaf-soft text-leaf hover:bg-leaf-soft hover:text-leaf")}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      <Icon className="w-4 h-4" />
    </Button>
  );
}

// Mounted fresh each time link editing starts, so it starts from the current link
function LinkForm({
  initialUrl,
  onSubmit,
  onCancel,
}: {
  initialUrl: string;
  onSubmit: (url: string) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState(initialUrl);

  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(url);
      }}
    >
      <input
        autoFocus
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder="Paste or type a link"
        aria-label="Link URL"
        className="h-7 w-56 rounded-sm bg-transparent px-2 text-sm outline-none"
      />
      <MenuButton label="Apply link" icon={Check} onClick={() => onSubmit(url)} />
      <MenuButton label="Cancel" icon={X} onClick={onCancel} />
    </form>
  );
}

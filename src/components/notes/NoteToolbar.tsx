// src/components/notes/NoteToolbar.tsx
"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import {
  Bold,
  ChevronDown,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Paperclip,
  Pilcrow,
  Quote,
  SquareCode,
  Strikethrough,
  Table,
  Underline,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useShortcut } from "@/hooks/useShortcut";
import { cn } from "@/lib/utils";

interface ToolbarAction {
  label: string;
  icon: LucideIcon;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

// Block types, in the order they are detected: wrappers (quote, code) win
// over the heading or paragraph inside them
const BLOCK_TYPES: ToolbarAction[] = [
  { label: "Code block", icon: SquareCode, isActive: (e) => e.isActive("codeBlock"), run: (e) => e.chain().focus().setCodeBlock().run() },
  { label: "Quote", icon: Quote, isActive: (e) => e.isActive("blockquote"), run: (e) => e.chain().focus().clearNodes().toggleBlockquote().run() },
  { label: "Heading 1", icon: Heading1, isActive: (e) => e.isActive("heading", { level: 1 }), run: (e) => e.chain().focus().setHeading({ level: 1 }).run() },
  { label: "Heading 2", icon: Heading2, isActive: (e) => e.isActive("heading", { level: 2 }), run: (e) => e.chain().focus().setHeading({ level: 2 }).run() },
  { label: "Heading 3", icon: Heading3, isActive: (e) => e.isActive("heading", { level: 3 }), run: (e) => e.chain().focus().setHeading({ level: 3 }).run() },
  { label: "Text", icon: Pilcrow, isActive: () => true, run: (e) => e.chain().focus().clearNodes().run() },
];

// Menu order for the block type dropdown
const BLOCK_MENU = ["Text", "Heading 1", "Heading 2", "Heading 3", "Quote", "Code block"].map(
  (label) => BLOCK_TYPES.find((b) => b.label === label)!
);

// Button groups, separated by a divider
const GROUPS: ToolbarAction[][] = [
  [
    { label: "Bold", icon: Bold, isActive: (e) => e.isActive("bold"), run: (e) => e.chain().focus().toggleBold().run() },
    { label: "Italic", icon: Italic, isActive: (e) => e.isActive("italic"), run: (e) => e.chain().focus().toggleItalic().run() },
    { label: "Underline", icon: Underline, isActive: (e) => e.isActive("underline"), run: (e) => e.chain().focus().toggleUnderline().run() },
    { label: "Strikethrough", icon: Strikethrough, isActive: (e) => e.isActive("strike"), run: (e) => e.chain().focus().toggleStrike().run() },
    { label: "Highlight", icon: Highlighter, isActive: (e) => e.isActive("highlight"), run: (e) => e.chain().focus().toggleHighlight().run() },
    { label: "Inline code", icon: Code, isActive: (e) => e.isActive("code"), run: (e) => e.chain().focus().toggleCode().run() },
  ],
  [
    { label: "Bullet list", icon: List, isActive: (e) => e.isActive("bulletList"), run: (e) => e.chain().focus().toggleBulletList().run() },
    { label: "Numbered list", icon: ListOrdered, isActive: (e) => e.isActive("orderedList"), run: (e) => e.chain().focus().toggleOrderedList().run() },
    { label: "Checklist", icon: ListChecks, isActive: (e) => e.isActive("taskList"), run: (e) => e.chain().focus().toggleTaskList().run() },
  ],
];

const ACTIONS = GROUPS.flat();

// Table operations, available while the cursor is in a table
const TABLE_ACTIONS: { label: string; run: (editor: Editor) => void; destructive?: boolean }[][] = [
  [
    { label: "Add row above", run: (e) => e.chain().focus().addRowBefore().run() },
    { label: "Add row below", run: (e) => e.chain().focus().addRowAfter().run() },
    { label: "Add column left", run: (e) => e.chain().focus().addColumnBefore().run() },
    { label: "Add column right", run: (e) => e.chain().focus().addColumnAfter().run() },
  ],
  [{ label: "Toggle header row", run: (e) => e.chain().focus().toggleHeaderRow().run() }],
  [
    { label: "Delete row", run: (e) => e.chain().focus().deleteRow().run(), destructive: true },
    { label: "Delete column", run: (e) => e.chain().focus().deleteColumn().run(), destructive: true },
    { label: "Delete table", run: (e) => e.chain().focus().deleteTable().run(), destructive: true },
  ],
];

const activeClass = "bg-leaf-soft text-leaf hover:bg-leaf-soft hover:text-leaf";

interface NoteToolbarProps {
  editor: Editor;
  // Opens the link editor in the bubble menu
  onEditLink: () => void;
  // Picks files to attach; absent when attachments aren't available
  onAttach?: () => void;
}

export function NoteToolbar({ editor, onEditLink, onAttach }: NoteToolbarProps) {
  const shortcut = useShortcut();
  // Re-render only when something shown here changes, not on every keystroke
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      active: ACTIONS.map((a) => a.isActive(editor)),
      block: BLOCK_TYPES.find((b) => b.isActive(editor))!.label,
      link: editor.isActive("link"),
      // A link needs selected text, or an existing link under the cursor
      canLink: !editor.state.selection.empty || editor.isActive("link"),
      inTable: editor.isActive("table"),
    }),
  });

  const block = BLOCK_TYPES.find((b) => b.label === state.block)!;
  // Radix returns focus to the trigger when a menu closes; send it back to the text
  const refocusEditor = (e: Event) => {
    e.preventDefault();
    editor.commands.focus();
  };

  let index = 0;
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className={cn(
        "flex items-center gap-0.5",
        // Phones: one line that scrolls sideways, fading out on the right to
        // show there's more; pr-8 lets the last buttons scroll clear of the fade
        "overflow-x-auto py-0.5 pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]",
        // Larger screens: wrap onto more lines as needed
        "sm:flex-wrap sm:overflow-visible sm:py-0 sm:pr-0 sm:[mask-image:none]"
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 justify-between sm:w-32"
            aria-label={`Block type: ${block.label}`}
          >
            <span className="flex items-center gap-1.5 truncate">
              <block.icon className="w-4 h-4" />
              {block.label}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" onCloseAutoFocus={refocusEditor}>
          {BLOCK_MENU.map((b) => (
            <DropdownMenuItem
              key={b.label}
              onSelect={() => b.label !== block.label && b.run(editor)}
              className={cn(b.label === block.label && "bg-leaf-soft text-leaf")}
            >
              <b.icon />
              {b.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {GROUPS.map((group, g) => (
        <div key={g} className="flex shrink-0 items-center gap-0.5">
          <Divider />
          {group.map((action) => {
            const isActive = state.active[index++];
            return (
              <ToolbarButton
                key={action.label}
                label={action.label}
                icon={action.icon}
                active={isActive}
                onClick={() => action.run(editor)}
              />
            );
          })}
        </div>
      ))}

      <Divider />
      <ToolbarButton
        label={`Link (${shortcut("K")})`}
        icon={Link2}
        active={state.link}
        disabled={!state.canLink}
        onClick={() => {
          editor.commands.focus();
          onEditLink();
        }}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 gap-0.5 px-2", state.inTable && activeClass)}
            aria-label="Table"
            title="Table"
          >
            <Table className="w-4 h-4" />
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" onCloseAutoFocus={refocusEditor}>
          <DropdownMenuItem
            disabled={state.inTable}
            onSelect={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
          >
            Insert table
          </DropdownMenuItem>
          {TABLE_ACTIONS.map((group, g) => (
            <div key={g}>
              <DropdownMenuSeparator />
              {group.map((action) => (
                <DropdownMenuItem
                  key={action.label}
                  disabled={!state.inTable}
                  variant={action.destructive ? "destructive" : "default"}
                  onSelect={() => action.run(editor)}
                >
                  {action.label}
                </DropdownMenuItem>
              ))}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {onAttach && (
        <>
          <Divider />
          <ToolbarButton label="Attach image or file" icon={Paperclip} onClick={onAttach} />
        </>
      )}
    </div>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />;
}

function ToolbarButton({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-8", active && activeClass)}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      <Icon className="w-4 h-4" />
    </Button>
  );
}

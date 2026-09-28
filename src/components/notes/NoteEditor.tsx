// src/components/notes/NoteEditor.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { ArrowLeft, Pin, PinOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoteBubbleMenu } from "@/components/notes/NoteBubbleMenu";
import { NoteToolbar } from "@/components/notes/NoteToolbar";
import { noteExtensions } from "@/components/notes/extensions";
import type { NoteInput } from "@/hooks/useNotes";
import type { Note, NoteContent } from "@/lib/notes";
import { cn } from "@/lib/utils";

const AUTOSAVE_DELAY = 800;

type SaveStatus = "saved" | "unsaved" | "saving";

const STATUS_LABELS: Record<SaveStatus, string> = {
  saved: "Saved",
  unsaved: "Edited",
  saving: "Saving…",
};

interface NoteEditorProps {
  note: Note;
  autoFocusTitle?: boolean;
  onSave: (id: string, input: NoteInput) => Promise<Note | null>;
  onTogglePin: (note: Note) => void;
  onDelete: (note: Note) => void;
  // Narrow screens only: return to the list
  onBack?: () => void;
}

// Edits one note and autosaves it. Mount with key={note.id}: the editor reads
// the note only once, so switching notes needs a fresh instance.
export function NoteEditor({
  note,
  autoFocusTitle,
  onSave,
  onTogglePin,
  onDelete,
  onBack,
}: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [status, setStatus] = useState<SaveStatus>("saved");
  // Link editor open in the bubble menu
  const [linkEditing, setLinkEditing] = useState(false);
  // Scroll container, so the bubble menu follows the text when it scrolls
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

  // Edits not yet sent, merged so each save sends only the latest values
  const pending = useRef<NoteInput>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Saves run one at a time so an older request can never land after a newer one
  const inflight = useRef<Promise<void>>(Promise.resolve());
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const noteId = note.id;
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    inflight.current = inflight.current.then(async () => {
      const input = pending.current;
      if (Object.keys(input).length === 0) return;
      pending.current = {};
      setStatus("saving");
      const saved = await onSaveRef.current(noteId, input);
      if (!saved) {
        // Keep the failed edits so the next save retries them
        pending.current = { ...input, ...pending.current };
      }
      setStatus(Object.keys(pending.current).length > 0 ? "unsaved" : "saved");
    });
    return inflight.current;
  }, [noteId]);

  const queue = useCallback(
    (input: NoteInput) => {
      pending.current = { ...pending.current, ...input };
      setStatus("unsaved");
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, AUTOSAVE_DELAY);
    },
    [flush]
  );

  // Save right away when switching notes, leaving the page or hiding the tab
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  const editor = useEditor({
    extensions: noteExtensions,
    content: note.content,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "note-content", "aria-label": "Note content" },
      // Cmd/Ctrl+click opens a link in a new tab
      handleClick: (_view, _pos, event) => {
        const link = (event.target as HTMLElement).closest("a");
        if (!link || !(event.metaKey || event.ctrlKey)) return false;
        window.open(link.href, "_blank", "noopener,noreferrer");
        return true;
      },
      // Cmd/Ctrl+K edits the link on the selection
      handleKeyDown: (view, event) => {
        if (event.key !== "k" || !(event.metaKey || event.ctrlKey)) return false;
        const onLink = view.state.selection.$from.marks().some((m) => m.type.name === "link");
        if (view.state.selection.empty && !onLink) return false;
        event.preventDefault();
        setLinkEditing(true);
        return true;
      },
    },
    onUpdate: ({ editor }) =>
      queue({
        content: editor.getJSON() as NoteContent,
        contentText: editor.getText({ blockSeparator: "\n" }),
      }),
  });

  // Moving the cursor elsewhere closes the link editor
  useEffect(() => {
    if (!editor) return;
    const close = () => setLinkEditing(false);
    editor.on("selectionUpdate", close);
    return () => {
      editor.off("selectionUpdate", close);
    };
  }, [editor]);

  const handleDelete = async () => {
    // Save first so Undo restores the latest text
    await flush();
    onDelete(note);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 pb-2">
        {onBack && (
          <Button variant="ghost" size="icon" className="size-8" onClick={onBack} aria-label="Back to notes">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <span className="flex-1 text-xs text-muted-foreground" aria-live="polite">
          {STATUS_LABELS[status]}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-8", note.pinned && "text-leaf")}
          onClick={() => onTogglePin(note)}
          aria-label={note.pinned ? "Unpin note" : "Pin note"}
          aria-pressed={note.pinned}
          title={note.pinned ? "Unpin" : "Pin"}
        >
          {note.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 hover:text-destructive"
          onClick={handleDelete}
          aria-label="Delete note"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {editor && (
        <div className="border-y py-1">
          <NoteToolbar editor={editor} onEditLink={() => setLinkEditing(true)} />
        </div>
      )}

      <div ref={setScrollEl} className="relative flex-1 min-h-0 overflow-y-auto pt-4">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            queue({ title: e.target.value });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              editor?.commands.focus("start");
            }
          }}
          autoFocus={autoFocusTitle}
          maxLength={200}
          placeholder="Untitled"
          aria-label="Note title"
          className="w-full bg-transparent text-2xl font-bold outline-none placeholder:text-muted-foreground/60 mb-3"
        />
        <EditorContent editor={editor} />
        {editor && (
          <NoteBubbleMenu
            editor={editor}
            linkEditing={linkEditing}
            onLinkEditingChange={setLinkEditing}
            scrollTarget={scrollEl}
          />
        )}
      </div>
    </div>
  );
}

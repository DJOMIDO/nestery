// src/components/notes/NoteEditor.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { toast } from "sonner";
import { ArrowLeft, Download, FileCode2, Pin, PinOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoteAttachments } from "@/components/notes/NoteAttachments";
import { NoteBubbleMenu } from "@/components/notes/NoteBubbleMenu";
import { NoteToolbar } from "@/components/notes/NoteToolbar";
import { noteExtensions } from "@/components/notes/extensions";
import { downloadMarkdown, noteToMarkdown } from "@/components/notes/markdown";
import { useNoteAttachments } from "@/hooks/useNoteAttachments";
import type { NoteInput } from "@/hooks/useNotes";
import { attachmentHref, formatBytes, isImage, type NoteAttachment } from "@/lib/attachments";
import type { Note, NoteContent } from "@/lib/notes";
import { cn } from "@/lib/utils";

const AUTOSAVE_DELAY = 800;

// Puts an uploaded file in the note at `pos`: images show inline, other
// files become a link
function insertAttachment(editor: Editor, attachment: NoteAttachment, pos: number) {
  const href = attachmentHref(attachment.id);
  const node = isImage(attachment.contentType)
    ? { type: "image", attrs: { src: href, alt: attachment.fileName } }
    : {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: `📎 ${attachment.fileName} (${formatBytes(attachment.size)})`,
            marks: [{ type: "link", attrs: { href } }],
          },
        ],
      };
  editor.chain().focus().insertContentAt(Math.min(pos, editor.state.doc.content.size), node).run();
}

// Takes a deleted file's images and links out of the note
function removeAttachment(editor: Editor, attachment: NoteAttachment) {
  const href = attachmentHref(attachment.id);
  const ranges: [number, number][] = [];
  editor.state.doc.descendants((node, pos) => {
    const links = node.isText && node.marks.some((m) => m.type.name === "link" && String(m.attrs.href).startsWith(href));
    if ((node.type.name === "image" && node.attrs.src === href) || links) ranges.push([pos, pos + node.nodeSize]);
  });
  if (!ranges.length) return;
  const tr = editor.state.tr;
  for (const [from, to] of ranges.reverse()) tr.delete(from, to);
  editor.view.dispatch(tr);
}

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
  // Markdown source view: the textarea holds the text, the hidden editor
  // follows it on every change so autosave keeps working unchanged
  const [sourceMode, setSourceMode] = useState(false);
  const [source, setSource] = useState("");
  // Scroll container, so the bubble menu follows the text when it scrolls
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const { attachments, upload, remove } = useNoteAttachments(note.id);
  const [uploading, setUploading] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  // The editor's paste and drop handlers are set once; they call the latest attach
  const attachRef = useRef<(files: File[], pos?: number) => void>(() => {});

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
      // Pasted files (e.g. a screenshot) are attached where the cursor is
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!files.length) return false;
        attachRef.current(files);
        return true;
      },
      // Files dropped in from outside are attached where they land
      handleDrop: (view, event, _slice, moved) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (moved || !files.length) return false;
        event.preventDefault();
        attachRef.current(files, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos);
        return true;
      },
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

  // Uploads one file at a time, each placed after the previous one
  const attach = async (files: File[], pos?: number) => {
    if (!editor || !files.length) return;
    let at = pos ?? editor.state.selection.to;
    setUploading((n) => n + files.length);
    for (const file of files) {
      try {
        const attachment = await upload(file);
        insertAttachment(editor, attachment, at);
        at = editor.state.selection.to;
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };
  useEffect(() => {
    attachRef.current = attach;
  });

  const handleDeleteAttachment = async (attachment: NoteAttachment) => {
    if (!window.confirm(`Delete ${attachment.fileName}? It is removed from the note too.`)) return;
    try {
      await remove(attachment.id);
      if (editor) removeAttachment(editor, attachment);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // Moving the cursor elsewhere closes the link editor
  useEffect(() => {
    if (!editor) return;
    const close = () => setLinkEditing(false);
    editor.on("selectionUpdate", close);
    return () => {
      editor.off("selectionUpdate", close);
    };
  }, [editor]);

  const toggleSource = () => {
    if (!editor) return;
    if (sourceMode) {
      setSourceMode(false);
      editor.commands.focus();
    } else {
      setSource(editor.getMarkdown());
      setSourceMode(true);
    }
  };

  const handleSourceChange = (markdown: string) => {
    setSource(markdown);
    editor?.commands.setContent(markdown, { contentType: "markdown", emitUpdate: true });
  };

  const handleExport = () => {
    if (editor) downloadMarkdown(title, noteToMarkdown(title, editor.getMarkdown()));
  };

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
          className={cn("size-8", sourceMode && "bg-leaf-soft text-leaf hover:bg-leaf-soft hover:text-leaf")}
          onClick={toggleSource}
          disabled={!editor}
          aria-label="Markdown source"
          aria-pressed={sourceMode}
          title={sourceMode ? "Back to formatted view" : "Edit as Markdown"}
        >
          <FileCode2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={handleExport}
          disabled={!editor}
          aria-label="Export as Markdown"
          title="Export as Markdown (.md)"
        >
          <Download className="w-4 h-4" />
        </Button>
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

      {sourceMode && (
        <div className="border-y py-2 px-1 text-xs text-muted-foreground">
          Editing as Markdown. Changes apply to the note as you type.
        </div>
      )}
      {editor && !sourceMode && (
        <div className="border-y py-1">
          <NoteToolbar
            editor={editor}
            onEditLink={() => setLinkEditing(true)}
            onAttach={() => fileInput.current?.click()}
          />
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
              if (!sourceMode) editor?.commands.focus("start");
            }
          }}
          autoFocus={autoFocusTitle}
          maxLength={200}
          placeholder="Untitled"
          aria-label="Note title"
          className="w-full bg-transparent text-2xl font-bold outline-none placeholder:text-muted-foreground/60 mb-3"
        />
        {sourceMode && (
          <textarea
            autoFocus
            value={source}
            onChange={(e) => handleSourceChange(e.target.value)}
            spellCheck={false}
            aria-label="Markdown source"
            className="w-full min-h-[40vh] field-sizing-content resize-none bg-transparent font-mono text-sm leading-relaxed outline-none"
          />
        )}
        <EditorContent editor={editor} className={cn(sourceMode && "hidden")} />
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            attach(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        {!sourceMode && (
          <NoteAttachments attachments={attachments} uploading={uploading} onDelete={handleDeleteAttachment} />
        )}
        {editor && !sourceMode && (
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

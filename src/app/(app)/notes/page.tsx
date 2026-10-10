// src/app/(app)/notes/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NotebookPen, Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { NoteListItem } from "@/components/notes/NoteListItem";
import { markdownToNote } from "@/components/notes/markdown";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNotes } from "@/hooks/useNotes";
import { compareNotes, matchesQuery, type Note } from "@/lib/notes";

// Same limit as a note's content on the server
const MAX_IMPORT_BYTES = 1_000_000;

// useSearchParams needs a Suspense boundary on a statically rendered page
export default function NotesPage() {
  return (
    <Suspense>
      <NotesView />
    </Suspense>
  );
}

function NotesView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { notes, loading, createNote, updateNote, deleteNote } = useNotes();
  // List and editor side by side on large screens (Tailwind `lg`), one at a time otherwise
  const isWide = useMediaQuery("(min-width: 1024px)");

  const [query, setQuery] = useState("");
  // ?note=<id> opens a note (links from the dashboard); &new=1 focuses its title
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    searchParams.get("note")
  );
  const [newNoteId, setNewNoteId] = useState<string | null>(() =>
    searchParams.get("new") ? searchParams.get("note") : null
  );

  // Drop the params once read so a reload does not jump back to that note.
  // A link followed while the page is open (e.g. from the assistant) selects it.
  useEffect(() => {
    const linked = searchParams.get("note");
    if (!linked) return;
    setSelectedId(linked);
    router.replace("/notes", { scroll: false });
  }, [searchParams, router]);

  const sorted = useMemo(() => [...notes].sort(compareNotes), [notes]);
  const visible = useMemo(
    () => sorted.filter((n) => matchesQuery(n, query)),
    [sorted, query]
  );

  // Wide screens always show a note when there is one
  const selected =
    notes.find((n) => n.id === selectedId) ?? (isWide ? sorted[0] ?? null : null);

  const handleCreate = async () => {
    const note = await createNote();
    if (!note) return;
    setQuery("");
    setSelectedId(note.id);
    setNewNoteId(note.id);
  };

  const fileInput = useRef<HTMLInputElement>(null);

  // Each Markdown file becomes a note; the last one imported is opened
  const handleImport = async (files: FileList | null) => {
    let last: Note | null = null;
    let count = 0;
    for (const file of Array.from(files ?? [])) {
      if (file.size > MAX_IMPORT_BYTES) {
        toast.error(`${file.name} is too large to import (max 1 MB)`);
        continue;
      }
      const note = await createNote(markdownToNote(await file.text(), file.name));
      if (note) {
        last = note;
        count++;
      }
    }
    if (!last) return;
    setQuery("");
    setSelectedId(last.id);
    toast.success(`Imported ${count} ${count === 1 ? "note" : "notes"}`);
  };

  const handleTogglePin = (note: Note) =>
    updateNote(note.id, { pinned: !note.pinned });

  const handleDelete = async (note: Note) => {
    if (!(await deleteNote(note.id))) return;
    if (selectedId === note.id) setSelectedId(null);
    toast("Note deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          const restored = await createNote({
            title: note.title,
            content: note.content,
            contentText: note.contentText,
            pinned: note.pinned,
          });
          if (restored) setSelectedId(restored.id);
        },
      },
    });
  };

  const showList = isWide || !selected;
  const showEditor = !!selected;

  return (
    // On large screens both columns fill the viewport and scroll on their own
    <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] lg:grid-rows-1 gap-6 h-full min-h-0">
      {showList && (
        <div className="flex flex-col min-h-0 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Notes</h1>
              <p className="text-sm text-muted-foreground">
                {notes.length} {notes.length === 1 ? "note" : "notes"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInput.current?.click()}
                aria-label="Import Markdown files"
                title="Import Markdown (.md)"
              >
                <Upload className="w-4 h-4" />
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                multiple
                hidden
                onChange={async (e) => {
                  const input = e.currentTarget;
                  await handleImport(input.files);
                  // Allow importing the same file again
                  input.value = "";
                }}
              />
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-1" /> New Note
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes"
              aria-label="Search notes"
              className="pl-9"
            />
          </div>

          {loading ? (
            // Fits the column like the list it stands in for, which scrolls on its own
            <ListSkeleton label="Loading notes" className="flex-1 min-h-0 overflow-hidden" />
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {query ? "No notes match your search." : "No notes yet."}
            </p>
          ) : (
            <ul className="flex-1 min-h-0 overflow-y-auto space-y-1 lg:pr-2">
              {visible.map((note) => (
                <NoteListItem
                  key={note.id}
                  note={note}
                  selected={note.id === selected?.id}
                  onSelect={(n) => setSelectedId(n.id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {showEditor ? (
        // A card on tablets and up; on phones (upright or sideways) the editor
        // has the screen to itself, so it drops the card's border and padding
        <div className="min-w-0 min-h-0 not-phone:rounded-lg not-phone:border not-phone:bg-card not-phone:p-4">
          <NoteEditor
            key={selected.id}
            note={selected}
            autoFocusTitle={selected.id === newNoteId}
            onSave={updateNote}
            onTogglePin={handleTogglePin}
            onDelete={handleDelete}
            onBack={isWide ? undefined : () => setSelectedId(null)}
          />
        </div>
      ) : (
        isWide &&
        !loading && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground">
            <NotebookPen className="w-8 h-8" />
            <p className="text-sm">Create your first note to get started.</p>
            <Button variant="outline" onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-1" /> New Note
            </Button>
          </div>
        )
      )}
    </div>
  );
}

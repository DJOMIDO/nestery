// src/hooks/useNotes.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { request } from "@/lib/api";
import { onDataChanged } from "@/lib/dataChanged";
import type { Note } from "@/lib/notes";

// Shape accepted by POST /api/notes and PATCH /api/notes/[id]
export type NoteInput = Partial<
  Pick<Note, "title" | "content" | "contentText" | "pinned" | "tags">
>;

// Loads the current user's notes and exposes create/update/delete helpers
// that keep the local list in sync. Errors are shown as toasts.
export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setNotes(await request<Note[]>("/api/notes"));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Notes changed elsewhere (by the assistant): reload, and count a version
  // for each note whose text changed, so an open editor can start over from it
  const [versions, setVersions] = useState<Record<string, number>>({});
  const notesRef = useRef(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  useEffect(
    () =>
      onDataChanged("notes", async () => {
        try {
          const fresh = await request<Note[]>("/api/notes");
          const before = new Map(notesRef.current.map((n) => [n.id, n.updatedAt]));
          const changed = fresh.filter((n) => before.has(n.id) && before.get(n.id) !== n.updatedAt);
          setNotes(fresh);
          if (changed.length) {
            setVersions((v) => ({ ...v, ...Object.fromEntries(changed.map((n) => [n.id, (v[n.id] ?? 0) + 1])) }));
          }
        } catch (err) {
          toast.error((err as Error).message);
        }
      }),
    []
  );

  const createNote = useCallback(async (input: NoteInput = {}) => {
    try {
      const note = await request<Note>("/api/notes", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setNotes((prev) => [note, ...prev]);
      return note;
    } catch (err) {
      toast.error((err as Error).message);
      return null;
    }
  }, []);

  // Optimistic. There is no rollback: the editor keeps the latest text and
  // the next autosave retries, so reverting the list would only flicker.
  const updateNote = useCallback(async (id: string, input: NoteInput) => {
    const edited = Object.keys(input).some((key) => key !== "pinned");
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              ...input,
              updatedAt: edited ? new Date().toISOString() : n.updatedAt,
            }
          : n
      )
    );
    try {
      const note = await request<Note>(`/api/notes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      // Keep the local text: the user may have typed more while this was in flight
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, updatedAt: note.updatedAt, pinned: note.pinned } : n
        )
      );
      return note;
    } catch (err) {
      toast.error((err as Error).message);
      return null;
    }
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    try {
      await request<null>(`/api/notes/${id}`, { method: "DELETE" });
      setNotes((prev) => prev.filter((n) => n.id !== id));
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    }
  }, []);

  return { notes, versions, loading, reload, createNote, updateNote, deleteNote };
}

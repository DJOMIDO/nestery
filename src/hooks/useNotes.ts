// src/hooks/useNotes.ts

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { request } from "@/lib/api";
import type { Note } from "@/lib/notes";

// Shape accepted by POST /api/notes and PATCH /api/notes/[id]
export type NoteInput = Partial<
  Pick<Note, "title" | "content" | "contentText" | "pinned">
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

  return { notes, loading, reload, createNote, updateNote, deleteNote };
}

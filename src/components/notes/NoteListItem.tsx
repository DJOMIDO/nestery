// src/components/notes/NoteListItem.tsx
"use client";

import { Pin } from "lucide-react";
import { noteTitle, type Note } from "@/lib/notes";
import { NotePreview } from "@/components/notes/NotePreview";
import { formatRelative } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { useFormat } from "@/components/SettingsProvider";

interface NoteListItemProps {
  note: Note;
  selected: boolean;
  onSelect: (note: Note) => void;
}

export function NoteListItem({ note, selected, onSelect }: NoteListItemProps) {
  const format = useFormat();
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(note)}
        aria-current={selected || undefined}
        className={cn(
          "w-full text-left rounded-md px-3 py-2 transition-colors border-l-4",
          selected
            ? "bg-leaf-soft border-leaf"
            : "border-transparent hover:bg-muted"
        )}
      >
        <div className="flex items-center gap-1.5">
          {note.pinned && <Pin className="w-3.5 h-3.5 shrink-0 text-leaf" aria-label="Pinned" />}
          <span className={cn("flex-1 truncate font-medium", !note.title.trim() && "text-muted-foreground")}>
            {noteTitle(note)}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatRelative(note.updatedAt, undefined, format.day)}
          </span>
        </div>
        <NotePreview note={note} className="mt-0.5 text-sm" />
      </button>
    </li>
  );
}

// src/components/dashboard/RecentNotesCard.tsx

"use client";

import Link from "next/link";
import { NotebookPen, Pin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CardHeading } from "./CardHeading";
import { useFormat } from "@/components/SettingsProvider";
import { compareNotes, noteHref, notePreview, noteTitle, type Note } from "@/lib/notes";
import { formatRelative } from "@/lib/tasks";

const MAX_NOTES = 5;

// Pinned notes first, then the most recently edited
export function RecentNotesCard({ notes }: { notes: Note[] }) {
  const format = useFormat();
  const shown = [...notes].sort(compareNotes).slice(0, MAX_NOTES);

  return (
    <Card className="w-full h-full rounded-lg bg-card">
      <CardContent className="p-4 flex flex-col min-h-0 flex-1">
        <CardHeading title="Recent notes" icon={NotebookPen} />
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No notes yet.{" "}
            <Link href="/notes" className="text-leaf underline-offset-2 hover:underline">
              Write one
            </Link>
          </p>
        ) : (
          <ul className="-mx-1 min-h-0 overflow-y-auto">
            {shown.map((note) => (
              <li key={note.id}>
                <Link href={noteHref(note.id)} className="block rounded-md px-1 py-1.5 hover:bg-muted/60">
                  <span className="flex items-center gap-1.5">
                    {note.pinned && <Pin className="size-3.5 shrink-0 text-leaf" aria-label="Pinned" />}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{noteTitle(note)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelative(note.updatedAt, undefined, format.day)}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{notePreview(note)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

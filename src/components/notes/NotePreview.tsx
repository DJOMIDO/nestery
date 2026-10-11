// src/components/notes/NotePreview.tsx
"use client";

import { useTranslations } from "next-intl";
import { Paperclip } from "lucide-react";
import { notePreview, type Note } from "@/lib/notes";
import { cn } from "@/lib/utils";

// A note's first line for lists, with a paperclip when it's an attached file
export function NotePreview({ note, className }: { note: Pick<Note, "content">; className?: string }) {
  const t = useTranslations("notes");
  const { text, file } = notePreview(note);
  return (
    <span className={cn("flex min-w-0 items-center gap-1 text-muted-foreground", className)}>
      {file && <Paperclip className="size-[1.1em] shrink-0" aria-label={t("file")} />}
      <span className="truncate">{text || t("noText")}</span>
    </span>
  );
}

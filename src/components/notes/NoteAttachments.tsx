// src/components/notes/NoteAttachments.tsx
// The files attached to a note, below its text: open (images and PDFs in
// the browser, other files download) or delete.

"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { attachmentHref, formatBytes, isImage, type NoteAttachment } from "@/lib/attachments";

interface NoteAttachmentsProps {
  attachments: NoteAttachment[];
  // Files still uploading
  uploading: number;
  onDelete: (attachment: NoteAttachment) => void;
}

export function NoteAttachments({ attachments, uploading, onDelete }: NoteAttachmentsProps) {
  const [open, setOpen] = useState(true);
  if (attachments.length === 0 && uploading === 0) return null;

  return (
    <section aria-label="Attachments" className="mt-8 border-t pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-sm font-semibold text-muted-foreground"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        Attachments ({attachments.length})
        {uploading > 0 && <span className="font-normal"> · uploading {uploading}…</span>}
      </button>
      {open && (
        <ul className="mt-2 space-y-1">
          {attachments.map((a) => {
            const href = attachmentHref(a.id);
            return (
              <li key={a.id} className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60">
                {isImage(a.contentType) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- served through the app's own redirect
                  <img src={href} alt="" loading="lazy" className="size-9 shrink-0 rounded border object-cover" />
                ) : (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded border bg-muted/50">
                    <FileText className="size-4 text-muted-foreground" />
                  </span>
                )}
                <a href={href} target="_blank" rel="noopener" className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate text-sm">{a.fileName}</span>
                  <span className="block text-xs text-muted-foreground">{formatBytes(a.size)}</span>
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 hover:text-destructive"
                  onClick={() => onDelete(a)}
                  title="Delete"
                  aria-label={`Delete ${a.fileName}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

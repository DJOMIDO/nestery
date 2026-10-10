// src/hooks/useNoteAttachments.ts

import { useCallback, useEffect, useState } from "react";
import { request } from "@/lib/api";
import { MAX_ATTACHMENT_BYTES, type NoteAttachment } from "@/lib/attachments";
import { shrinkForNote } from "@/lib/imageAttachment";

// A note's files, and uploading new ones: the browser sends the file straight
// to storage through a signed URL, then the server checks it
export function useNoteAttachments(noteId: string) {
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);

  const reload = useCallback(async () => {
    try {
      setAttachments(await request<NoteAttachment[]>(`/api/notes/${noteId}/attachments`));
    } catch {
      // The list is extra; the note works without it
    }
  }, [noteId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Throws with a message fit to show
  const upload = useCallback(
    async (original: File) => {
      const file = await shrinkForNote(original);
      if (file.size > MAX_ATTACHMENT_BYTES) {
        throw new Error(`${file.name} is larger than ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`);
      }
      const contentType = file.type || "application/octet-stream";
      const { attachment, uploadUrl, uploadHeaders } = await request<{
        attachment: NoteAttachment;
        uploadUrl: string;
        // Signed with the URL, so they must be sent as they are
        uploadHeaders: Record<string, string>;
      }>(
        `/api/notes/${noteId}/attachments`,
        { method: "POST", body: JSON.stringify({ fileName: file.name || "file", contentType, size: file.size }) }
      );
      const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: uploadHeaders });
      if (!put.ok) throw new Error(`Uploading ${file.name} failed (${put.status}).`);
      const saved = await request<NoteAttachment>(`/api/attachments/${attachment.id}/complete`, { method: "POST" });
      setAttachments((prev) => [...prev, saved]);
      return saved;
    },
    [noteId]
  );

  const remove = useCallback(async (id: string) => {
    await request(`/api/attachments/${id}`, { method: "DELETE" });
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { attachments, upload, remove, reload };
}

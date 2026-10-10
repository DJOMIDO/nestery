// src/lib/attachments.ts
// Note attachments: types and limits shared by the server and the editor.
// Keep this file free of server-only imports.

// Per file; large photos are shrunk in the browser before this applies
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

// All of a user's files together (the free storage plan holds 5 GB in all)
export const MAX_USER_STORAGE_BYTES = 1024 * 1024 * 1024;

export interface NoteAttachment {
  id: string;
  noteId: string | null;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
}

// The app's own link to a file: it checks the owner, then redirects to a
// short-lived storage link. Notes keep this link, which never expires.
export const attachmentHref = (id: string) => `/api/attachments/${id}`;
export const isAttachmentHref = (href: unknown) => String(href).startsWith("/api/attachments/");

// Notes once put a 📎 before a file link's name; the app now shows a
// paperclip icon instead (the editor's is in globals.css). Drops the old
// emoji from a note's content, so those notes show the icon too.
export function withoutAttachmentEmoji<T>(content: T): T {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== "object") return node;
    const n = node as { type?: string; text?: string; marks?: { type: string; attrs?: { href?: unknown } }[] };
    const isFileLink = n.marks?.some((m) => m.type === "link" && isAttachmentHref(m.attrs?.href));
    if (n.type === "text" && isFileLink && n.text?.startsWith("📎 ")) return { ...n, text: n.text.slice(3) };
    return Object.fromEntries(Object.entries(n).map(([k, v]) => [k, k === "content" ? strip(v) : v]));
  };
  return strip(content) as T;
}

// Ids of the files a note's content links to
export function attachmentIdsIn(content: unknown) {
  const ids = new Set<string>();
  for (const match of JSON.stringify(content ?? "").matchAll(/\/api\/attachments\/([0-9a-f-]{36})/g)) ids.add(match[1]);
  return [...ids];
}

// Shown in the browser rather than downloaded. Others (HTML, SVG…) are always
// downloads, so a file can't run scripts when opened.
export const opensInline = (contentType: string) =>
  /^image\/(jpeg|png|gif|webp|avif)$/.test(contentType) || contentType === "application/pdf";

export const isImage = (contentType: string) => /^image\/(jpeg|png|gif|webp|avif)$/.test(contentType);

// "1.2 MB"
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

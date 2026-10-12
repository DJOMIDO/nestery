// src/server/avatar.ts
// Profile photos. Like note attachments, the browser uploads straight to
// storage through a signed URL and the server checks the file afterwards.
// The user's `image` then points at the app's link to it; signing in with
// GitHub or Google may have set it to that provider's photo instead.

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { AVATAR_TYPES, MAX_AVATAR_BYTES, avatarHref } from "@/lib/avatar";
import { AttachmentError } from "@/server/attachments";
import { deleteStored, deleteStoredPrefix, downloadUrl, storageEnabled, storedSize, uploadUrl } from "@/server/storage";

export const createAvatarUploadInput = z.object({
  contentType: z.enum(AVATAR_TYPES, { message: "Choose a JPEG, PNG, WebP, GIF or AVIF image." }),
  size: z.number().int().min(1).max(MAX_AVATAR_BYTES, "The image is larger than 1 MB."),
});

// Under the user's files, so deleting the account removes them too
const prefixFor = (userId: string) => `u/${userId}/avatar/`;
const keyFor = (userId: string, id: string) => `${prefixFor(userId)}${id}`;

// Step 1: where the browser uploads the photo
export async function createAvatarUpload(userId: string, input: z.infer<typeof createAvatarUploadInput>) {
  const id = crypto.randomUUID();
  const extension = input.contentType.split("/")[1];
  const upload = await uploadUrl(keyFor(userId, id), {
    fileName: `avatar.${extension}`,
    contentType: input.contentType,
    inline: true,
  });
  return { id, uploadUrl: upload.url, uploadHeaders: upload.headers };
}

// Step 2: the browser finished; check the file and make it the user's photo.
// Earlier photos, and uploads that were never finished, are removed.
export async function completeAvatarUpload(userId: string, id: string) {
  const key = keyFor(userId, id);
  const size = await storedSize(key);
  if (size === null) throw new AttachmentError("The upload didn't arrive. Try again.");
  if (size > MAX_AVATAR_BYTES) {
    await deleteStored(key);
    throw new AttachmentError("The image is larger than 1 MB.", 413);
  }
  const image = avatarHref(id);
  await db.update(user).set({ image }).where(eq(user.id, userId));
  await deleteStoredPrefix(prefixFor(userId), key).catch((err) => console.error("Removing old photos failed", err));
  return { image };
}

// Back to initials, whether the photo was uploaded or from GitHub or Google
export async function removeAvatar(userId: string) {
  await db.update(user).set({ image: null }).where(eq(user.id, userId));
  // Without storage, only a provider's photo can have been set
  if (!storageEnabled()) return;
  await deleteStoredPrefix(prefixFor(userId)).catch((err) => console.error("Removing photos failed", err));
}

// A signed link to one of the user's own photos
export const avatarLink = (userId: string, id: string) => downloadUrl(keyFor(userId, id));

// src/lib/imageAttachment.ts
// Shrinks an image the user attaches to an assistant message, in the browser:
// phone photos are several MB, while text on a ticket stays readable at about
// 1600 px. The result is a JPEG under the server's size limit.

import { MAX_IMAGE_BASE64, type AssistantImage } from "@/lib/assistant";

// Longest side, then smaller if the file is still too large
const SIZES = [1600, 1200, 900];
const QUALITY = 0.85;

const ACCEPTED = /^image\/(jpeg|png|webp|gif|heic|heif)$/;

export const isAttachableImage = (file: File) => ACCEPTED.test(file.type);

async function encode(bitmap: ImageBitmap, longest: number) {
  const scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d")!;
  // Transparent screenshots get a white background instead of black
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", QUALITY);
}

// The image ready to send, plus a data URL to show it in the panel
export async function prepareImage(file: File): Promise<{ image: AssistantImage; preview: string }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`Couldn't read ${file.name || "that image"}. Try a JPEG or PNG.`);
  }
  try {
    for (const longest of SIZES) {
      const dataUrl = await encode(bitmap, longest);
      const data = dataUrl.slice(dataUrl.indexOf(",") + 1);
      if (data.length <= MAX_IMAGE_BASE64) return { image: { mediaType: "image/jpeg", data }, preview: dataUrl };
    }
    throw new Error(`${file.name || "That image"} is too large, even after shrinking it.`);
  } finally {
    bitmap.close();
  }
}

// For note attachments: photos over 2 MB (or in HEIC, which most browsers
// can't show) become a JPEG of at most 2400 px. Smaller images, GIFs and
// other files are kept as they are.
export async function shrinkForNote(file: File): Promise<File> {
  const heic = /^image\/hei[cf]$/.test(file.type);
  const photo = /^image\/(jpeg|png|webp)$/.test(file.type);
  if (!heic && !(photo && file.size > 2 * 1024 * 1024)) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const dataUrl = await encode(bitmap, 2400);
    const blob = await (await fetch(dataUrl)).blob();
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return blob.size < file.size || heic ? new File([blob], name, { type: "image/jpeg" }) : file;
  } finally {
    bitmap.close();
  }
}

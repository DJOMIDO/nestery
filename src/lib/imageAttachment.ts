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

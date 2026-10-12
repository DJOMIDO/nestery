// src/lib/avatar.ts
// Profile photos: types and limits shared by the server and Settings.
// Keep this file free of server-only imports.

// Raster images browsers show; no SVG, which can carry scripts
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"] as const;

export const MAX_AVATAR_BYTES = 1024 * 1024;

export const isAvatarType = (type: string): type is (typeof AVATAR_TYPES)[number] =>
  (AVATAR_TYPES as readonly string[]).includes(type);

// The app's own link to an uploaded photo, kept as the user's image. A new
// photo gets a new id, so browsers can cache each one for good.
export const avatarHref = (id: string) => `/api/account/avatar/${id}`;

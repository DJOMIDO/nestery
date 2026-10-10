// src/server/secrets.ts
// Encryption for secrets stored in the database (users' own API keys), with
// AES-256-GCM and a key from ASSISTANT_ENCRYPTION_KEY. A leaked database alone
// does not reveal the keys.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

// 32 random bytes, base64: `openssl rand -base64 32`
function encryptionKey() {
  const raw = process.env.ASSISTANT_ENCRYPTION_KEY;
  const key = raw ? Buffer.from(raw, "base64") : null;
  if (!key || key.length !== 32) {
    throw new Error("ASSISTANT_ENCRYPTION_KEY must be 32 bytes, base64 encoded");
  }
  return key;
}

export const secretsEnabled = () => {
  try {
    encryptionKey();
    return true;
  } catch {
    return false;
  }
};

// "v1.<iv>.<auth tag>.<ciphertext>", each part base64url
export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decryptSecret(stored: string) {
  const [version, iv, tag, data] = stored.split(".");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("Unreadable secret");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

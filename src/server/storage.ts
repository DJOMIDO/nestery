// src/server/storage.ts
// Neon Object Storage (S3-compatible). Files go straight between the browser
// and the bucket through short-lived signed URLs; the app's server only signs
// them, checks uploads and deletes.
//
// Settings: NEON_STORAGE_ENDPOINT, NEON_STORAGE_REGION, NEON_STORAGE_BUCKET,
// NEON_STORAGE_ACCESS_KEY_ID, NEON_STORAGE_SECRET_ACCESS_KEY (not the AWS_*
// names, which Vercel reserves).

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const env = process.env;

export const storageEnabled = () =>
  !!(
    env.NEON_STORAGE_ENDPOINT &&
    env.NEON_STORAGE_BUCKET &&
    env.NEON_STORAGE_ACCESS_KEY_ID &&
    env.NEON_STORAGE_SECRET_ACCESS_KEY
  );

let client: S3Client | null = null;
const s3 = () =>
  (client ??= new S3Client({
    endpoint: env.NEON_STORAGE_ENDPOINT,
    region: env.NEON_STORAGE_REGION || "us-east-2",
    // Neon's endpoint takes the bucket in the path
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.NEON_STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: env.NEON_STORAGE_SECRET_ACCESS_KEY!,
    },
  }));

const Bucket = () => env.NEON_STORAGE_BUCKET!;

// Where the browser PUTs the file, and the headers it must send with it.
// Neon doesn't take response-header overrides on downloads, so the file's
// name, how it opens and how long it may be cached are stored with it here.
export async function uploadUrl(
  key: string,
  { fileName, contentType, inline }: { fileName: string; contentType: string; inline: boolean }
) {
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`);
  const headers = {
    "Content-Type": contentType,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encoded}`,
    // Each file has its own key and never changes
    "Cache-Control": "private, max-age=31536000, immutable",
  };
  const url = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: Bucket(),
      Key: key,
      ContentType: headers["Content-Type"],
      ContentDisposition: headers["Content-Disposition"],
      CacheControl: headers["Cache-Control"],
    }),
    { expiresIn: 15 * 60 }
  );
  return { url, headers };
}

const HOUR_MS = 60 * 60 * 1000;

// A link to read the file. Signed as of the start of the hour, so the same
// file gets the same URL for an hour and the browser can cache it.
export function downloadUrl(key: string) {
  const hour = new Date(Math.floor(Date.now() / HOUR_MS) * HOUR_MS);
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: Bucket(), Key: key }),
    // Valid past the end of the hour it was signed in
    { expiresIn: 2 * 60 * 60, signingDate: hour }
  );
}

// Size of a stored file, or null if it isn't there
export async function storedSize(key: string) {
  try {
    const head = await s3().send(new HeadObjectCommand({ Bucket: Bucket(), Key: key }));
    return head.ContentLength ?? 0;
  } catch {
    return null;
  }
}

export async function deleteStored(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: Bucket(), Key: key }));
}

// Everything under a prefix (e.g. a deleted account's files)
export async function deleteStoredPrefix(prefix: string) {
  let token: string | undefined;
  do {
    const page = await s3().send(new ListObjectsV2Command({ Bucket: Bucket(), Prefix: prefix, ContinuationToken: token }));
    const keys = (page.Contents ?? []).map((o) => ({ Key: o.Key! }));
    if (keys.length) await s3().send(new DeleteObjectsCommand({ Bucket: Bucket(), Delete: { Objects: keys } }));
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
}

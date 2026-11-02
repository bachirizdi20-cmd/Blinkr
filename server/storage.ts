// Storage helpers for Blinkr. Avatars can fall back to the application's
// persistent MySQL database when no object-storage provider is configured.
import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

let s3Client: S3Client | null = null;

function hasS3Config() {
  return Boolean(
    ENV.s3Endpoint &&
      ENV.s3Region &&
      ENV.s3Bucket &&
      ENV.s3AccessKeyId &&
      ENV.s3SecretAccessKey,
  );
}

function getS3Config(): { client: S3Client; bucket: string } {
  if (!hasS3Config()) {
    throw new Error(
      "S3 storage config missing: set S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY",
    );
  }
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: ENV.s3Endpoint.replace(/\/+$/, ""),
      region: ENV.s3Region,
      credentials: {
        accessKeyId: ENV.s3AccessKeyId,
        secretAccessKey: ENV.s3SecretAccessKey,
      },
      forcePathStyle: true,
    });
  }
  return { client: s3Client, bucket: ENV.s3Bucket };
}

function hasForgeConfig() {
  return Boolean(ENV.forgeApiUrl && ENV.forgeApiKey);
}

function normalizeKey(relKey: string) {
  return relKey.replace(/^\/+/, "");
}

function databaseAvatarKey(relKey: string) {
  const key = normalizeKey(relKey);
  const match = /^avatars\/db\/user-(\d+)_([a-f0-9]{8})$/.exec(key);
  return match ? { key, userId: Number(match[1]) } : null;
}

function appendHashSuffix(relKey: string) {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

/** Reports whether profile-avatar storage is configured, without exposing secrets. */
export function isStorageConfigured() {
  return hasS3Config() || hasForgeConfig() || Boolean(ENV.databaseUrl);
}

/** Avatars stored in MySQL or S3 can be physically deleted; Forge cannot. */
export function isStorageDeletionSupported() {
  return hasS3Config() || Boolean(ENV.databaseUrl);
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const body = typeof data === "string" ? Buffer.from(data, "utf-8") : Buffer.from(data);

  if (hasS3Config()) {
    const { client, bucket } = getS3Config();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return { key, url: `/manus-storage/${key}` };
  }

  if (hasForgeConfig()) {
    const forgeUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
    const presignUrl = new URL("v1/storage/presign/put", `${forgeUrl}/`);
    presignUrl.searchParams.set("path", key);
    const presignResp = await fetch(presignUrl, {
      headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
    });
    if (!presignResp.ok) {
      const msg = await presignResp.text().catch(() => presignResp.statusText);
      throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
    }
    const { url: uploadUrl } = (await presignResp.json()) as { url?: string };
    if (!uploadUrl) throw new Error("Storage backend returned an empty presign URL");
    const uploadResp = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body,
    });
    if (!uploadResp.ok) throw new Error(`Storage upload failed (${uploadResp.status})`);
    return { key, url: `/manus-storage/${key}` };
  }

  const avatarMatch = /^avatars\/user-(\d+)_([a-f0-9]{8})$/.exec(key);
  if (ENV.databaseUrl && contentType === "image/jpeg" && avatarMatch && body.byteLength <= 150 * 1024) {
    const databaseKey = `avatars/db/user-${avatarMatch[1]}_${avatarMatch[2]}`;
    const { saveAvatarBlob } = await import("./db");
    await saveAvatarBlob({
      key: databaseKey,
      userId: Number(avatarMatch[1]),
      data: body,
      contentType: "image/jpeg",
    });
    return { key: databaseKey, url: `/manus-storage/${databaseKey}` };
  }

  throw new Error("Storage config missing: configure S3-compatible storage for non-avatar uploads");
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string) {
  const key = normalizeKey(relKey);
  if (hasS3Config()) {
    const { client, bucket } = getS3Config();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 3600 },
    );
  }

  if (!hasForgeConfig()) throw new Error("External storage is not configured for this key");
  const forgeUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
  const getUrl = new URL("v1/storage/presign/get", `${forgeUrl}/`);
  getUrl.searchParams.set("path", key);
  const response = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
  });
  if (!response.ok) {
    const msg = await response.text().catch(() => response.statusText);
    throw new Error(`Storage signed URL failed (${response.status}): ${msg}`);
  }
  const { url } = (await response.json()) as { url?: string };
  if (!url) throw new Error("Storage backend returned an empty signed URL");
  return url;
}

export async function storageDelete(relKey: string): Promise<boolean> {
  const databaseKey = databaseAvatarKey(relKey);
  if (databaseKey) {
    if (!ENV.databaseUrl) return false;
    const { deleteAvatarBlob } = await import("./db");
    return deleteAvatarBlob(databaseKey.key, databaseKey.userId);
  }

  if (!hasS3Config()) return false;
  const { client, bucket } = getS3Config();
  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: normalizeKey(relKey) }),
  );
  return true;
}

export function isDatabaseAvatarKey(relKey: string) {
  return databaseAvatarKey(relKey) !== null;
}

export async function readDatabaseAvatar(relKey: string) {
  const databaseKey = databaseAvatarKey(relKey);
  if (!databaseKey) return null;
  const { readAvatarBlob } = await import("./db");
  return readAvatarBlob(databaseKey.key);
}

/** Extract a storage key from a URL returned by storagePut. */
export function storageKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/^\/manus-storage\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

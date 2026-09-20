// Storage helpers for Blinkr.
//
// Production/self-hosted deployments use any S3-compatible object store
// (OCI Object Storage or Cloudflare R2). The Manus Forge path remains as a
// compatibility fallback so the WebDev preview keeps working.
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

function getForgeConfig() {
  if (!hasForgeConfig()) {
    throw new Error(
      "Storage config missing: configure S3 or BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY",
    );
  }
  return {
    forgeUrl: ENV.forgeApiUrl.replace(/\/+$/, ""),
    forgeKey: ENV.forgeApiKey,
  };
}

function normalizeKey(relKey: string) {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string) {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
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

  const { forgeUrl, forgeKey } = getForgeConfig();
  const presignUrl = new URL("v1/storage/presign/put", `${forgeUrl}/`);
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
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
  if (!uploadResp.ok) {
    throw new Error(`Storage upload failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
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

  const { forgeUrl, forgeKey } = getForgeConfig();
  const getUrl = new URL("v1/storage/presign/get", `${forgeUrl}/`);
  getUrl.searchParams.set("path", key);
  const response = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });
  if (!response.ok) {
    const msg = await response.text().catch(() => response.statusText);
    throw new Error(`Storage signed URL failed (${response.status}): ${msg}`);
  }
  const { url } = (await response.json()) as { url?: string };
  if (!url) throw new Error("Storage backend returned an empty signed URL");
  return url;
}

export async function storageDelete(relKey: string) {
  if (!hasS3Config()) return;
  const { client, bucket } = getS3Config();
  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: normalizeKey(relKey) }),
  );
}

/** Extract a storage key from a URL returned by storagePut. */
export function storageKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/^\/manus-storage\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

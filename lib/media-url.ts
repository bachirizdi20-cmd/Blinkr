import { getApiBaseUrl } from "../constants/oauth";

const REMOTE_SCHEMES = /^(https?:|data:|blob:|file:|content:|ph:)/i;

/**
 * Converts a stored relative asset path into an absolute API URL.
 * Local picker URIs are preserved so previews continue to work before upload.
 */
export function resolveMediaUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (REMOTE_SCHEMES.test(trimmed)) return trimmed;

  const base = getApiBaseUrl();
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return base ? `${base}${path}` : undefined;
}

export function isLocalMediaUri(value: string | null | undefined): boolean {
  return Boolean(value && /^(file:|content:|ph:|blob:|data:)/i.test(value));
}

export function isStoredMediaUrl(value: string | null | undefined): boolean {
  return Boolean(value && (/^\/manus-storage\//i.test(value) || /^https?:\/\//i.test(value)));
}

import { ENV } from "./_core/env";

const API = "https://comicvine.gamespot.com/api";
const CACHE_TTL = 5 * 60 * 1000;
const DETAIL_TTL = 6 * 60 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: unknown }>();

export type ComicVineComic = {
  id: number;
  title: string;
  issueNumber: string | null;
  volumeName: string | null;
  coverUrl: string | null;
  description: string | null;
  deck: string | null;
  publisher: string | null;
  publishDate: string | null;
  creators: string[];
  rating: number | null;
  sourceUrl: string;
};

export type ComicVinePage = {
  results: ComicVineComic[];
  page: number;
  limit: number;
  totalResults: number;
  totalPages: number;
};

export class ComicVineError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message);
    this.name = "ComicVineError";
  }
}

function cached<T>(key: string): T | null {
  const item = cache.get(key);
  if (!item) return null;
  if (item.expiresAt < Date.now()) { cache.delete(key); return null; }
  return item.value as T;
}

function put(key: string, value: unknown, ttl = CACHE_TTL) {
  if (cache.size > 200) cache.delete(cache.keys().next().value as string);
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return normalized || null;
}

function idOf(value: unknown): number | null {
  const id = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function imageOf(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const image = value as Record<string, unknown>;
  return typeof image.original_url === "string" ? image.original_url : typeof image.medium_url === "string" ? image.medium_url : null;
}

function names(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    return text(record.name) ?? text(record.person) ?? text(record.role);
  }).filter((item): item is string => Boolean(item)).slice(0, 8);
}

function normalize(value: unknown): ComicVineComic | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const id = idOf(item.id);
  const title = text(item.name) ?? text(item.volume_name);
  if (!id || !title) return null;
  const volume = item.volume && typeof item.volume === "object" ? item.volume as Record<string, unknown> : null;
  const publisher = item.publisher;
  const publisherName = publisher && typeof publisher === "object" ? text((publisher as Record<string, unknown>).name) : text(publisher);
  return {
    id,
    title,
    issueNumber: text(item.issue_number),
    volumeName: text(volume?.name) ?? text(item.volume_name),
    coverUrl: imageOf(item.image) ?? imageOf(volume?.image),
    description: text(item.description),
    deck: text(item.deck),
    publisher: publisherName,
    publishDate: text(item.cover_date) ?? text(item.date_added),
    creators: names(item.person_credits ?? item.character_credits),
    rating: typeof item.rating === "number" ? item.rating : null,
    sourceUrl: text(item.site_detail_url) ?? `https://comicvine.gamespot.com/issue/${id}/`,
  };
}

async function request<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const key = ENV.comicVineApiKey;
  if (!key) throw new ComicVineError("مصدر Comic Vine غير مهيأ على الخادم.");
  const url = new URL(`${API}/${path.replace(/^\//, "")}`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("format", "json");
  url.searchParams.set("field_list", "id,name,issue_number,volume,volume_name,image,description,deck,publisher,cover_date,site_detail_url,person_credits,character_credits,rating");
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, String(value)));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Blinkr/1.0" }, signal: controller.signal });
    const payload = await response.json().catch(() => null) as { status_code?: number; error?: string; number_of_total_results?: number; results?: unknown } | null;
    if (!response.ok || payload?.status_code !== 1) {
      throw new ComicVineError(response.status === 401 || response.status === 403 ? "مفتاح Comic Vine غير صالح أو منتهي." : payload?.error ?? "تعذر جلب بيانات Comic Vine.", response.status);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ComicVineError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new ComicVineError("انتهت مهلة الاتصال بـ Comic Vine.");
    throw new ComicVineError("تعذر الاتصال بمصدر Comic Vine.");
  } finally { clearTimeout(timeout); }
}

export async function searchComicVine(query: string, page = 1, limit = 20): Promise<ComicVinePage> {
  const key = `search:${query}:${page}:${limit}`;
  const hit = cached<ComicVinePage>(key);
  if (hit) return hit;
  const payload = await request<{ number_of_total_results?: number; results?: unknown[] }>("search/", { query, resources: "issue,volume", page, limit });
  const results = (payload.results ?? []).map(normalize).filter((item): item is ComicVineComic => item !== null);
  const totalResults = payload.number_of_total_results ?? results.length;
  const result = { results, page, limit, totalResults, totalPages: Math.max(1, Math.ceil(totalResults / limit)) };
  put(key, result);
  return result;
}

export async function getTrendingComicVine(limit = 12): Promise<ComicVineComic[]> {
  const key = `trending:${limit}`;
  const hit = cached<ComicVineComic[]>(key);
  if (hit) return hit;
  const payload = await request<{ results?: unknown[] }>("volumes/", { sort: "rating:desc", limit, page: 1 });
  const results = (payload.results ?? []).map(normalize).filter((item): item is ComicVineComic => item !== null);
  put(key, results);
  return results;
}

export async function getComicVineComic(id: number): Promise<ComicVineComic> {
  const key = `detail:${id}`;
  const hit = cached<ComicVineComic>(key);
  if (hit) return hit;
  let raw: unknown;
  try {
    const payload = await request<{ results?: unknown }>(`issue/${id}/`, {});
    raw = payload.results;
  } catch (error) {
    if (!(error instanceof ComicVineError) || error.status === 401 || error.status === 403) throw error;
    const payload = await request<{ results?: unknown }>(`volume/${id}/`, {});
    raw = payload.results;
  }
  const result = normalize(raw);
  if (!result) throw new ComicVineError("لم يُعثر على الكوميك في Comic Vine.", 404);
  put(key, result, DETAIL_TTL);
  return result;
}

export async function getSimilarComicVine(id: number, title: string, publisher: string | null, limit = 8): Promise<ComicVineComic[]> {
  const query = publisher || title.split(/[:#-]/)[0].trim();
  const page = await searchComicVine(query || title, 1, limit + 4);
  return page.results.filter((item) => item.id !== id).slice(0, limit);
}

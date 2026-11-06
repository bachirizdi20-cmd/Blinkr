import { ENV } from "./_core/env";

const HARDCOVER_API = "https://api.hardcover.app/v1/graphql";
const HARDCOVER_USER_AGENT = "Blinkr/1.0 (book discovery; https://bachirizdi20-cmd.github.io/Blinkr/)";
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const BOOK_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;
const responseCache = new Map<string, { expiresAt: number; value: unknown }>();

export type HardcoverBook = {
  workId: number;
  workKey: string;
  title: string;
  authorNames: string[];
  firstPublishYear: number | null;
  firstPublishDate: string | null;
  coverId: number | null;
  coverUrl: string | null;
  isbn: string | null;
  pageCount: number | null;
  editionCount: number;
  ratingsAverage: number | null;
  ratingsCount: number;
  subjects: string[];
  description: string | null;
  sourceUrl: string;
};

export type HardcoverSearchResult = {
  results: HardcoverBook[];
  page: number;
  limit: number;
  totalResults: number;
  totalPages: number;
};

export class HardcoverError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message);
    this.name = "HardcoverError";
  }
}

function getCached<T>(key: string): T | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }
  responseCache.delete(key);
  responseCache.set(key, entry);
  return entry.value as T;
}

function setCached(key: string, value: unknown, ttlMs: number): void {
  if (responseCache.size >= MAX_CACHE_ENTRIES && !responseCache.has(key)) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function positiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringArray(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      if (typeof item === "string") return [item];
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return typeof record.name === "string" ? [record.name] : typeof record.title === "string" ? [record.title] : [];
      }
      return [];
    })
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

function contributionNames(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => item && typeof item === "object" ? (item as Record<string, unknown>).author : null)
    .filter((author): author is Record<string, unknown> => Boolean(author && typeof author === "object"))
    .map((author) => typeof author.name === "string" ? author.name.trim() : "")
    .filter(Boolean)
    .slice(0, max);
}

function normalizeDescription(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 12_000) : null;
}

function imageUrl(value: unknown): string | null {
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.url === "string" && /^https?:\/\//i.test(record.url)) return record.url;
  if (record.image) return imageUrl(record.image);
  if (Array.isArray(record.images)) return imageUrl(record.images[0]);
  return null;
}

function hardcoverUrl(slug: unknown, id: number): string {
  return typeof slug === "string" && slug.trim()
    ? `https://hardcover.app/books/${encodeURIComponent(slug.trim())}`
    : `https://hardcover.app/books/${id}`;
}

function normalizeBook(value: unknown): HardcoverBook | null {
  if (typeof value === "string") {
    try { return normalizeBook(JSON.parse(value)); } catch { return null; }
  }
  if (!value || typeof value !== "object") return null;
  const book = value as Record<string, unknown>;
  const workId = positiveInteger(book.id);
  const title = typeof book.title === "string" ? book.title.trim() : "";
  if (!workId || !title) return null;
  const releaseYear = positiveInteger(book.release_year);
  const releaseDate = typeof book.release_date === "string" ? book.release_date.slice(0, 80) : null;
  const coverUrl = imageUrl(book.image) ?? imageUrl(book.cached_image);
  const isbns = stringArray(book.isbns, 100);
  const authorNames = stringArray(book.author_names, 8).length > 0
    ? stringArray(book.author_names, 8)
    : contributionNames(book.contributions, 8);
  const rating = finiteNumber(book.rating);
  return {
    workId,
    workKey: typeof book.slug === "string" && book.slug.trim() ? book.slug.trim() : `hardcover-${workId}`,
    title: title.slice(0, 255),
    authorNames,
    firstPublishYear: releaseYear,
    firstPublishDate: releaseDate,
    coverId: null,
    coverUrl,
    isbn: isbns.find((item) => item.length === 13) ?? isbns.find((item) => item.length === 10) ?? null,
    pageCount: positiveInteger(book.pages),
    editionCount: positiveInteger(book.editions_count) ?? 0,
    ratingsAverage: rating !== null && rating >= 0 && rating <= 5 ? rating : null,
    ratingsCount: positiveInteger(book.ratings_count) ?? 0,
    subjects: stringArray(book.genres ?? book.tags, 8),
    description: normalizeDescription(book.description),
    sourceUrl: hardcoverUrl(book.slug, workId),
  };
}

async function fetchHardcover<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = ENV.hardcoverApiToken;
  if (!token) throw new HardcoverError("مصدر Hardcover غير مهيأ على الخادم.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(HARDCOVER_API, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: token,
        "User-Agent": HARDCOVER_USER_AGENT,
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null) as { data?: T; errors?: Array<{ message?: string }>; error?: string } | null;
    if (!response.ok || payload?.errors?.length) {
      const message = payload?.errors?.[0]?.message ?? payload?.error;
      throw new HardcoverError(response.status === 401 || response.status === 403 ? "مفتاح Hardcover غير صالح أو لا يملك صلاحية قراءة الكتالوج." : message || "تعذر جلب بيانات الكتب من Hardcover.", response.status);
    }
    if (!payload?.data) throw new HardcoverError("استجاب Hardcover دون بيانات.", response.status);
    return payload.data;
  } catch (error) {
    if (error instanceof HardcoverError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new HardcoverError("انتهت مهلة الاتصال بـ Hardcover.");
    throw new HardcoverError("تعذر الاتصال بمصدر الكتب Hardcover.");
  } finally {
    clearTimeout(timeout);
  }
}

const SEARCH_QUERY = `query SearchBooks($query: String!, $page: Int!, $per_page: Int!) {
  search(query: $query, query_type: "Book", page: $page, per_page: $per_page) {
    ids
    results
  }
}`;

const BOOKS_BY_ID_QUERY = `query BooksById($ids: [Int!]!, $limit: Int!) {
  books(where: { id: { _in: $ids } }, limit: $limit) {
    id title subtitle description pages rating ratings_count release_date release_year slug image { url }
    editions_count contributions { author { name } }
  }
}`;

const TRENDING_QUERY = `query TrendingBooks($duration: BooksTrendingDuration!, $limit: Int!) {
  books_trending(duration: $duration, limit: $limit) { ids error }
}`;

export async function getHardcoverTrendingBooks(limit = 10): Promise<HardcoverBook[]> {
  const cacheKey = `trending:${limit}`;
  const cached = getCached<HardcoverBook[]>(cacheKey);
  if (cached) return cached;
  const trending = await fetchHardcover<{ books_trending?: { ids?: unknown[]; error?: string | null } }>(TRENDING_QUERY, { duration: "month", limit });
  const ids = (Array.isArray(trending.books_trending?.ids) ? trending.books_trending.ids : [])
    .map(positiveInteger).filter((id): id is number => id !== null).slice(0, limit);
  if (ids.length === 0) return [];
  const details = await fetchHardcover<{ books?: unknown[] }>(BOOKS_BY_ID_QUERY, { ids, limit });
  const books = (details.books ?? []).map(normalizeBook).filter((book): book is HardcoverBook => book !== null);
  setCached(cacheKey, books, SEARCH_CACHE_TTL_MS);
  return books;
}

export async function searchHardcoverBooks(query: string, page = 1, limit = 20): Promise<HardcoverSearchResult> {
  const cacheKey = `search:${query}:${page}:${limit}`;
  const cached = getCached<HardcoverSearchResult>(cacheKey);
  if (cached) return cached;
  const payload = await fetchHardcover<{ search?: { ids?: unknown[]; results?: unknown[] } }>(SEARCH_QUERY, { query, page, per_page: limit });
  const search = payload.search ?? {};
  const rawResultItems = Array.isArray(search.results) ? search.results : [];
  const rawResults = rawResultItems.map(normalizeBook).filter((book): book is HardcoverBook => book !== null);
  const rawIds = Array.isArray(search.ids) ? search.ids : [];
  const ids = rawIds.map(positiveInteger).filter((id): id is number => id !== null).slice(0, limit);
  const detailPayload = rawResults.length > 0 || ids.length === 0
    ? null
    : await fetchHardcover<{ books?: unknown[] }>(BOOKS_BY_ID_QUERY, { ids, limit });
  const results = (detailPayload?.books ?? rawResults).map(normalizeBook).filter((book): book is HardcoverBook => book !== null);
  const result = { results, page, limit, totalResults: results.length, totalPages: results.length < limit ? page : page + 1 };
  setCached(cacheKey, result, SEARCH_CACHE_TTL_MS);
  return result;
}

const DETAIL_QUERY = `query GetBook($id: Int!) {
  books(where: { id: { _eq: $id } }, limit: 1) {
    id title subtitle description pages rating ratings_count release_date release_year slug image { url }
    editions_count contributions { author { name } }
  }
}`;

export async function getHardcoverBook(bookId: number): Promise<HardcoverBook> {
  const cacheKey = `book:${bookId}`;
  const cached = getCached<HardcoverBook>(cacheKey);
  if (cached) return cached;
  const payload = await fetchHardcover<{ books?: unknown[] }>(DETAIL_QUERY, { id: bookId });
  const book = normalizeBook(payload.books?.[0]);
  if (!book) throw new HardcoverError("لم يُعثر على الكتاب في Hardcover.", 404);
  setCached(cacheKey, book, BOOK_CACHE_TTL_MS);
  return book;
}

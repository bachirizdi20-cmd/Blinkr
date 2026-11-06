import { ENV } from "./_core/env";

const HARDCOVER_API = "https://api.hardcover.app/v1/graphql";
const HARDCOVER_USER_AGENT = "Blinkr/1.0 (book discovery; https://bachirizdi20-cmd.github.io/Blinkr/)";
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const BOOK_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;
const responseCache = new Map<string, { expiresAt: number; value: unknown }>();
const pendingRequests = new Map<string, Promise<unknown>>();
const requestTimes: number[] = [];
const MAX_REQUESTS_PER_MINUTE = 45;
const MAX_PENDING_REQUESTS = 8;

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
  totalResults: number | null;
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
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function stringArray(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      if (typeof item === "string") return [item];
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return typeof record.name === "string" ? [record.name] : typeof record.title === "string" ? [record.title] : typeof record.tag === "string" ? [record.tag] : [];
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
    .filter((item) => {
      if (!item || typeof item !== "object") return false;
      const role = (item as Record<string, unknown>).contributor_role;
      if (!role || typeof role !== "object") return true;
      const slug = (role as Record<string, unknown>).slug;
      return typeof slug !== "string" || slug.toLowerCase() === "author";
    })
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
  if (typeof value === "string") {
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      if (url.protocol !== "https:" || url.username || url.password || !host || /^\[.*\]$/.test(host) || /^\d+(?:\.\d+){3}$/.test(host) || /(^|\.)(localhost|local|internal)$/.test(host)) return null;
      return url.href;
    } catch { return null; }
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.url === "string") return imageUrl(record.url);
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
  const physicalEdition = book.default_physical_edition && typeof book.default_physical_edition === "object"
    ? book.default_physical_edition as Record<string, unknown> : {};
  const coverEdition = book.default_cover_edition && typeof book.default_cover_edition === "object"
    ? book.default_cover_edition as Record<string, unknown> : {};
  const coverUrl = imageUrl(book.image) ?? imageUrl(book.cached_image) ?? imageUrl(coverEdition.image) ?? imageUrl(coverEdition.cached_image) ?? imageUrl(physicalEdition.image) ?? imageUrl(physicalEdition.cached_image);
  const isbns = [physicalEdition.isbn_13, coverEdition.isbn_13, physicalEdition.isbn_10, coverEdition.isbn_10, ...stringArray(book.isbns, 100)]
    .filter((isbn): isbn is string => typeof isbn === "string" && isbn.trim().length > 0);
  const authorNames = stringArray(book.author_names, 8).length > 0
    ? stringArray(book.author_names, 8)
    : contributionNames(book.contributions, 8);
  const rating = finiteNumber(book.rating);
  const cachedTags = book.cached_tags && typeof book.cached_tags === "object" ? book.cached_tags as Record<string, unknown> : {};
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
    subjects: stringArray(book.genres ?? book.tags ?? cachedTags.Genre, 8),
    description: normalizeDescription(book.description),
    sourceUrl: hardcoverUrl(book.slug, workId),
  };
}

async function fetchHardcover<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const key = JSON.stringify([query, variables]);
  const pending = pendingRequests.get(key);
  if (pending) return pending as Promise<T>;
  const now = Date.now();
  while (requestTimes.length && requestTimes[0] <= now - 60_000) requestTimes.shift();
  if (pendingRequests.size >= MAX_PENDING_REQUESTS || requestTimes.length >= MAX_REQUESTS_PER_MINUTE) {
    throw new HardcoverError("طلبات الكتب كثيرة حاليًا، حاول لاحقًا.", 429);
  }
  requestTimes.push(now);
  const request = fetchHardcoverUncached<T>(query, variables);
  pendingRequests.set(key, request);
  try {
    return await request;
  } finally {
    pendingRequests.delete(key);
  }
}

async function fetchHardcoverUncached<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const token = ENV.hardcoverApiToken.trim().replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HardcoverError("مصدر Hardcover غير مهيأ على الخادم.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(HARDCOVER_API, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": HARDCOVER_USER_AGENT,
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null) as { data?: T; errors?: Array<{ message?: string }>; error?: string; error_description?: string } | null;
    if (!response.ok || payload?.errors?.length) {
      const isAuthError = response.status === 401 || (response.status === 403 && payload?.error !== "request_exceeds_capacity") || payload?.error === "invalid_token" ||
        (payload?.error === "invalid_request" && /authorization|token/i.test(payload.error_description ?? ""));
      if (isAuthError) throw new HardcoverError("مفتاح Hardcover غير صالح أو لا يملك صلاحية قراءة الكتالوج.", response.status === 403 ? 403 : 401);
      throw new HardcoverError("تعذر جلب بيانات الكتب من Hardcover.", response.status);
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
    error
  }
}`;

const BOOKS_BY_ID_QUERY = `query BooksById($ids: [Int!]!, $limit: Int!) {
  books(where: { id: { _in: $ids } }, limit: $limit) {
    id title subtitle description pages rating ratings_count release_date release_year slug image { url } cached_image cached_tags
    editions_count contributions { author { name } contributor_role { slug } }
    default_physical_edition { isbn_13 isbn_10 image { url } cached_image }
    default_cover_edition { isbn_13 isbn_10 image { url } cached_image }
  }
}`;

const TRENDING_QUERY = `query TrendingBooks($limit: Int!) {
  books_trending(duration: month, limit: $limit) { ids error }
}`;

export async function getHardcoverTrendingBooks(limit = 10): Promise<HardcoverBook[]> {
  const cacheKey = `trending:${limit}`;
  const cached = getCached<HardcoverBook[]>(cacheKey);
  if (cached) return cached;
  const trending = await fetchHardcover<{ books_trending?: { ids?: unknown[]; error?: string | null } }>(TRENDING_QUERY, { limit });
  if (!trending.books_trending || !Array.isArray(trending.books_trending.ids)) throw new HardcoverError("استجاب Hardcover ببيانات كتب رائجة غير مكتملة.");
  if (trending.books_trending?.error) throw new HardcoverError("تعذر تحميل الكتب الرائجة من Hardcover.");
  const ids = (Array.isArray(trending.books_trending?.ids) ? trending.books_trending.ids : [])
    .map(positiveInteger).filter((id): id is number => id !== null).slice(0, limit);
  if (ids.length === 0) return [];
  const details = await fetchHardcover<{ books?: unknown[] }>(BOOKS_BY_ID_QUERY, { ids, limit });
  if (!Array.isArray(details.books)) throw new HardcoverError("استجاب Hardcover ببيانات كتب غير مكتملة.");
  const byId = new Map((details.books ?? []).map(normalizeBook).filter((book): book is HardcoverBook => book !== null).map((book) => [book.workId, book]));
  const books = ids.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
  setCached(cacheKey, books, SEARCH_CACHE_TTL_MS);
  return books;
}

function searchPayload(value: unknown): { documents: unknown[]; found: number | null } {
  if (typeof value === "string") {
    try { return searchPayload(JSON.parse(value)); } catch { return { documents: [], found: null }; }
  }
  if (Array.isArray(value)) return { documents: value, found: null };
  if (!value || typeof value !== "object") return { documents: [], found: null };
  const result = value as Record<string, unknown>;
  const hits = Array.isArray(result.hits) ? result.hits : [];
  const documents = hits.map((hit) => hit && typeof hit === "object" && "document" in hit ? (hit as { document: unknown }).document : hit);
  const found = typeof result.found === "number" && Number.isSafeInteger(result.found) && result.found >= 0 ? result.found : null;
  return { documents, found };
}

export async function searchHardcoverBooks(query: string, page = 1, limit = 20): Promise<HardcoverSearchResult> {
  const cacheKey = `search:${query}:${page}:${limit}`;
  const cached = getCached<HardcoverSearchResult>(cacheKey);
  if (cached) return cached;
  const payload = await fetchHardcover<{ search?: { ids?: unknown[]; results?: unknown; error?: string | null } }>(SEARCH_QUERY, { query, page, per_page: limit });
  if (!payload.search) throw new HardcoverError("استجاب Hardcover ببيانات بحث غير مكتملة.");
  const search = payload.search;
  if (search.error) throw new HardcoverError("تعذر البحث عن الكتب في Hardcover.");
  const indexed = searchPayload(search.results);
  const rawResults = indexed.documents.map(normalizeBook).filter((book): book is HardcoverBook => book !== null);
  const rawIds = Array.isArray(search.ids) ? search.ids : [];
  const ids = (rawIds.length ? rawIds : rawResults.map((book) => book.workId))
    .map(positiveInteger).filter((id): id is number => id !== null).slice(0, limit);
  const detailPayload = ids.length ? await fetchHardcover<{ books?: unknown[] }>(BOOKS_BY_ID_QUERY, { ids, limit }) : null;
  if (detailPayload && !Array.isArray(detailPayload.books)) throw new HardcoverError("استجاب Hardcover ببيانات كتب غير مكتملة.");
  const byId = new Map(rawResults.map((book) => [book.workId, book]));
  for (const rawBook of detailPayload?.books ?? []) {
    const book = normalizeBook(rawBook);
    if (!book) continue;
    const indexedBook = byId.get(book.workId);
    const details = rawBook && typeof rawBook === "object" ? rawBook as Record<string, unknown> : {};
    byId.set(book.workId, {
      ...book,
      authorNames: book.authorNames.length ? book.authorNames : indexedBook?.authorNames ?? [],
      isbn: book.isbn ?? indexedBook?.isbn ?? null,
      subjects: book.subjects.length ? book.subjects : indexedBook?.subjects ?? [],
      coverUrl: book.coverUrl ?? indexedBook?.coverUrl ?? null,
      description: book.description ?? indexedBook?.description ?? null,
      firstPublishYear: book.firstPublishYear ?? indexedBook?.firstPublishYear ?? null,
      firstPublishDate: book.firstPublishDate ?? indexedBook?.firstPublishDate ?? null,
      pageCount: book.pageCount ?? indexedBook?.pageCount ?? null,
      ratingsAverage: book.ratingsAverage ?? indexedBook?.ratingsAverage ?? null,
      ratingsCount: details.ratings_count == null ? indexedBook?.ratingsCount ?? 0 : book.ratingsCount,
      editionCount: details.editions_count == null ? indexedBook?.editionCount ?? 0 : book.editionCount,
    });
  }
  const results = ids.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
  const totalResults = indexed.found;
  const totalPages = Math.min(1000, indexed.found === null ? page + (results.length === limit ? 1 : 0) : Math.ceil(indexed.found / limit));
  const result = { results, page, limit, totalResults, totalPages };
  setCached(cacheKey, result, SEARCH_CACHE_TTL_MS);
  return result;
}

const DETAIL_QUERY = `query GetBook($id: Int!) {
  books(where: { id: { _eq: $id } }, limit: 1) {
    id title subtitle description pages rating ratings_count release_date release_year slug image { url } cached_image cached_tags
    editions_count contributions { author { name } contributor_role { slug } }
    default_physical_edition { isbn_13 isbn_10 image { url } cached_image }
    default_cover_edition { isbn_13 isbn_10 image { url } cached_image }
  }
}`;

export async function getHardcoverBook(bookId: number): Promise<HardcoverBook> {
  const cacheKey = `book:${bookId}`;
  const cached = getCached<HardcoverBook>(cacheKey);
  if (cached) return cached;
  const payload = await fetchHardcover<{ books?: unknown[] }>(DETAIL_QUERY, { id: bookId });
  if (!Array.isArray(payload.books)) throw new HardcoverError("استجاب Hardcover ببيانات كتاب غير مكتملة.");
  const book = normalizeBook(payload.books?.[0]);
  if (!book) throw new HardcoverError("لم يُعثر على الكتاب في Hardcover.", 404);
  setCached(cacheKey, book, BOOK_CACHE_TTL_MS);
  return book;
}

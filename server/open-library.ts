const OPEN_LIBRARY_API = "https://openlibrary.org";
const OPEN_LIBRARY_USER_AGENT = "Blinkr/1.0 (book discovery; https://bachirizdi20-cmd.github.io/Blinkr/)";
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const WORK_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;
const responseCache = new Map<string, { expiresAt: number; value: unknown }>();
const SEARCH_FIELDS = [
  "key",
  "title",
  "author_name",
  "first_publish_year",
  "cover_i",
  "isbn",
  "number_of_pages_median",
  "edition_count",
  "ratings_average",
  "ratings_count",
  "subject",
].join(",");

export type OpenLibraryBook = {
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
};

export type OpenLibrarySearchResult = {
  results: OpenLibraryBook[];
  page: number;
  limit: number;
  totalResults: number;
  totalPages: number;
};

export class OpenLibraryError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "OpenLibraryError";
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

export function parseOpenLibraryWorkId(key: unknown): number | null {
  if (typeof key !== "string") return null;
  const match = /^\/?works\/OL([1-9]\d*)W$/.exec(key);
  if (!match) return null;
  const workId = Number(match[1]);
  return Number.isSafeInteger(workId) && workId <= 2_147_483_647 ? workId : null;
}

export function openLibraryCoverUrl(coverId: unknown, size: "S" | "M" | "L" = "M"): string | null {
  if (typeof coverId !== "number" || !Number.isSafeInteger(coverId) || coverId <= 0) return null;
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg?default=false`;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringArray(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

export function normalizeOpenLibraryDescription(value: unknown): string | null {
  const raw = typeof value === "string"
    ? value
    : value && typeof value === "object" && "value" in value && typeof value.value === "string"
      ? value.value
      : null;
  if (!raw) return null;
  const text = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 12_000) : null;
}

export function normalizeOpenLibraryBook(value: unknown): OpenLibraryBook | null {
  if (!value || typeof value !== "object") return null;
  const doc = value as Record<string, unknown>;
  const workId = parseOpenLibraryWorkId(doc.key);
  const title = typeof doc.title === "string" ? doc.title.trim() : "";
  if (!workId || !title) return null;

  const coverId = positiveInteger(doc.cover_i);
  const isbnList = stringArray(doc.isbn, 100);
  const isbn = isbnList.find((item) => item.length === 13) ?? isbnList.find((item) => item.length === 10) ?? null;
  const firstPublishYear = positiveInteger(doc.first_publish_year);
  const ratingsAverage = finiteNumber(doc.ratings_average);

  return {
    workId,
    workKey: `/works/OL${workId}W`,
    title: title.slice(0, 255),
    authorNames: stringArray(doc.author_name, 8),
    firstPublishYear,
    firstPublishDate: null,
    coverId,
    coverUrl: openLibraryCoverUrl(coverId),
    isbn,
    pageCount: positiveInteger(doc.number_of_pages_median),
    editionCount: positiveInteger(doc.edition_count) ?? 0,
    ratingsAverage: ratingsAverage !== null && ratingsAverage >= 0 && ratingsAverage <= 5 ? ratingsAverage : null,
    ratingsCount: positiveInteger(doc.ratings_count) ?? 0,
    subjects: stringArray(doc.subject, 8),
    description: normalizeOpenLibraryDescription(doc.description),
  };
}

async function fetchOpenLibraryJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${OPEN_LIBRARY_API}${path}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": OPEN_LIBRARY_USER_AGENT,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new OpenLibraryError(
        response.status === 404 ? "لم يُعثر على الكتاب في Open Library." : "تعذر جلب بيانات الكتب مؤقتًا.",
        response.status,
      );
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof OpenLibraryError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new OpenLibraryError("انتهت مهلة الاتصال بمصدر الكتب.");
    }
    throw new OpenLibraryError("تعذر الاتصال بمصدر الكتب.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchOpenLibraryBooks(
  query: string,
  page = 1,
  limit = 20,
): Promise<OpenLibrarySearchResult> {
  const params = new URLSearchParams({
    q: query,
    fields: SEARCH_FIELDS,
    page: String(page),
    limit: String(limit),
  });
  const cacheKey = `search:${params.toString()}`;
  const cached = getCached<OpenLibrarySearchResult>(cacheKey);
  if (cached) return cached;
  const payload = await fetchOpenLibraryJson<{
    numFound?: number;
    num_found?: number;
    docs?: unknown[];
  }>(`/search.json?${params.toString()}`);
  const totalResults = Math.max(0, Math.floor(payload.numFound ?? payload.num_found ?? 0));
  const results = (payload.docs ?? [])
    .map(normalizeOpenLibraryBook)
    .filter((book): book is OpenLibraryBook => book !== null);
  const result = {
    results,
    page,
    limit,
    totalResults,
    totalPages: Math.ceil(totalResults / limit),
  };
  setCached(cacheKey, result, SEARCH_CACHE_TTL_MS);
  return result;
}

export async function getOpenLibraryWork(workId: number): Promise<Pick<OpenLibraryBook, "workId" | "workKey" | "firstPublishDate" | "coverId" | "coverUrl" | "subjects" | "description">> {
  const cacheKey = `work:${workId}`;
  const cached = getCached<Pick<OpenLibraryBook, "workId" | "workKey" | "firstPublishDate" | "coverId" | "coverUrl" | "subjects" | "description">>(cacheKey);
  if (cached) return cached;
  const work = await fetchOpenLibraryJson<Record<string, unknown>>(`/works/OL${workId}W.json`);
  const covers = Array.isArray(work.covers) ? work.covers : [];
  const coverId = positiveInteger(covers[0]);
  const result = {
    workId,
    workKey: `/works/OL${workId}W`,
    firstPublishDate: typeof work.first_publish_date === "string" ? work.first_publish_date.slice(0, 80) : null,
    coverId,
    coverUrl: openLibraryCoverUrl(coverId),
    subjects: stringArray(work.subjects, 12),
    description: normalizeOpenLibraryDescription(work.description),
  };
  setCached(cacheKey, result, WORK_CACHE_TTL_MS);
  return result;
}

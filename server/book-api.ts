export type BookResult = {
  id: number;
  bookKey: string;
  title: string;
  authors: string[];
  publisher: string | null;
  publishedYear: number | null;
  description: string | null;
  coverUrl: string | null;
  isbn10: string | null;
  isbn13: string | null;
  pageCount: number | null;
  subjects: string[];
  language: string | null;
};

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  publisher?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
  number_of_pages_median?: number;
  subject?: string[];
  language?: string[];
};

type OpenLibraryResponse = { docs?: OpenLibraryDoc[]; numFound?: number };

function stableBookId(key: string) {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) || 1;
}

function normalizeBook(doc: OpenLibraryDoc): BookResult | null {
  if (!doc.key || !doc.title) return null;
  const isbn = doc.isbn ?? [];
  return {
    id: stableBookId(doc.key),
    bookKey: doc.key,
    title: doc.title,
    authors: (doc.author_name ?? []).slice(0, 4),
    publisher: doc.publisher?.[0] ?? null,
    publishedYear: doc.first_publish_year ?? null,
    description: null,
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    isbn10: isbn.find((value) => value.length === 10) ?? null,
    isbn13: isbn.find((value) => value.length === 13) ?? null,
    pageCount: doc.number_of_pages_median ?? null,
    subjects: (doc.subject ?? []).slice(0, 8),
    language: doc.language?.[0] ?? null,
  };
}

type BookSearchResponse = { results: BookResult[]; total: number; page: number; hasMore: boolean };
const searchCache = new Map<string, { expiresAt: number; value: BookSearchResponse }>();

export async function searchBooks(query: string, page: number, limit: number): Promise<BookSearchResponse> {
  const params = new URLSearchParams({
    q: query.trim() || "the",
    page: String(page),
    limit: String(Math.min(limit, 40)),
    fields: "key,title,author_name,publisher,first_publish_year,cover_i,isbn,subject,language",
  });
  const cacheKey = `${query.trim() || 'the'}:${page}:${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let response: Response | null = null;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      response = await fetch(`https://openlibrary.org/search.json?${params.toString()}`, {
        headers: { "User-Agent": "Agon/1.0 (book discovery app; contact@agon.app)" },
        signal: controller.signal,
      });
      if (response.ok) break;
      lastError = new Error(`Open Library request failed (${response.status})`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  if (!response?.ok) throw new Error(lastError instanceof Error ? lastError.message : 'Open Library is temporarily unavailable');
  const body = (await response.json()) as OpenLibraryResponse;
  const value: BookSearchResponse = {
    results: (body.docs ?? []).map(normalizeBook).filter((book): book is BookResult => Boolean(book)),
    total: body.numFound ?? 0,
    page,
    hasMore: (body.docs?.length ?? 0) === limit,
  };
  searchCache.set(cacheKey, { expiresAt: Date.now() + 60_000, value });
  return value;
}

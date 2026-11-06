import type { BookSummary } from '../types/books';

export type BookSource = 'hardcover' | 'unknown';

/** Accept only secure, non-local cover URLs returned by Hardcover. */
export function bookCoverUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && host && !url.username && !url.password && host !== 'covers.openlibrary.org' && !host.endsWith('.openlibrary.org') && !/^\[.*\]$/.test(host) && !/^\d+(?:\.\d+){3}$/.test(host) && !/(^|\.)(localhost|local|internal)$/.test(host)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** Identify only Hardcover records; legacy records remain unknown. */
export function bookSource(book: Partial<BookSummary> | null | undefined): BookSource {
  if (!book) return 'unknown';
  if (book.sourceUrl) {
    try {
      const host = new URL(book.sourceUrl).hostname.toLowerCase();
      if (host === 'hardcover.app' || host.endsWith('.hardcover.app')) return 'hardcover';
    } catch { /* Fall through to the stored cover. */ }
  }
  if (book.workKey && /^\/?works\/OL[1-9]\d*W$/i.test(book.workKey)) return 'unknown';
  if (book.workKey) return 'hardcover';
  return 'unknown';
}

/** A title mismatch in an untagged saved record can signal an ID collision. */
export function isBookDetailCompatible(fallback?: Partial<BookSummary>, detail?: Partial<BookSummary> | null): boolean {
  if (!fallback || !detail || bookSource(fallback) !== 'unknown' || !fallback.title?.trim() || !detail.title?.trim()) return true;
  const normalize = (title: string) => title.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  return normalize(fallback.title) === normalize(detail.title);
}

/** Prefer detail fields but keep usable search/persisted values when the detail is sparse. */
export function mergeBookDetails(workId: number, fallback?: Partial<BookSummary>, detail?: Partial<BookSummary> | null): BookSummary {
  const preferArray = (first?: string[], second?: string[]) => first?.length ? first : second ?? [];
  return {
    workId,
    workKey: detail?.workKey ?? fallback?.workKey ?? `hardcover-${workId}`,
    title: detail?.title?.trim() || fallback?.title?.trim() || 'كتاب',
    authorNames: preferArray(detail?.authorNames, fallback?.authorNames),
    firstPublishYear: detail?.firstPublishYear ?? fallback?.firstPublishYear ?? null,
    firstPublishDate: detail?.firstPublishDate ?? fallback?.firstPublishDate ?? null,
    coverId: detail?.coverId ?? fallback?.coverId ?? null,
    coverUrl: bookCoverUrl(detail?.coverUrl) ?? bookCoverUrl(fallback?.coverUrl),
    isbn: detail?.isbn ?? fallback?.isbn ?? null,
    pageCount: detail?.pageCount ?? fallback?.pageCount ?? null,
    editionCount: detail?.editionCount ?? fallback?.editionCount ?? 0,
    ratingsAverage: detail?.ratingsAverage ?? fallback?.ratingsAverage ?? null,
    ratingsCount: detail?.ratingsCount ?? fallback?.ratingsCount ?? 0,
    subjects: preferArray(detail?.subjects, fallback?.subjects),
    description: detail?.description || fallback?.description || null,
    sourceUrl: detail?.sourceUrl,
  };
}

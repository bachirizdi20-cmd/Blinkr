import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchBooks } from '../server/book-api';

describe('books.search', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('normalizes Open Library results and builds a cover URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      numFound: 100,
      docs: [{
        key: '/works/OL1W',
        title: 'The Hobbit',
        author_name: ['J. R. R. Tolkien'],
        publisher: ['Allen & Unwin'],
        first_publish_year: 1937,
        cover_i: 12345,
        isbn: ['0261102214', '9780261102217'],
        subject: ['Fantasy'],
        language: ['eng'],
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchBooks('', 1, 24);

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      bookKey: '/works/OL1W',
      title: 'The Hobbit',
      authors: ['J. R. R. Tolkien'],
      coverUrl: 'https://covers.openlibrary.org/b/id/12345-M.jpg',
      isbn13: '9780261102217',
    });
    expect(result.hasMore).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('q=the'), expect.objectContaining({
      headers: expect.objectContaining({ 'User-Agent': expect.stringContaining('Agon') }),
    }));
  });

  it('retries a failed upstream request once', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('temporary network error'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ docs: [], numFound: 0 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(searchBooks('Dune', 1, 24)).resolves.toMatchObject({ results: [], page: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

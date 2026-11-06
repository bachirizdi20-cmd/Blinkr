import { describe, expect, it } from 'vitest';
import { bookCoverUrl, bookSource, isBookDetailCompatible, mergeBookDetails } from './book-utils';

describe('Hardcover book utilities', () => {
  it('accepts secure Hardcover covers and rejects Open Library or unsafe URLs', () => {
    const hardcover = 'https://assets.hardcover.app/covers/cover.jpg?width=200';
    expect(bookCoverUrl(hardcover)).toBe(hardcover);
    expect(bookCoverUrl('https://covers.openlibrary.org/b/id/42-M.jpg')).toBeNull();
    expect(bookCoverUrl('javascript:alert(1)')).toBeNull();
    expect(bookCoverUrl('https://user:password@example.org/a.jpg')).toBeNull();
    expect(bookCoverUrl('http://example.org/a.jpg')).toBeNull();
    expect(bookCoverUrl('https://127.0.0.1/private')).toBeNull();
    expect(bookCoverUrl('/poster.jpg')).toBeNull();
    expect(bookCoverUrl(null)).toBeNull();
  });

  it('identifies Hardcover records and leaves legacy records unknown', () => {
    expect(bookSource({ workKey: 'dune', sourceUrl: 'https://hardcover.app/books/dune' })).toBe('hardcover');
    expect(bookSource({ workKey: '/works/OL123W' })).toBe('unknown');
    expect(bookSource({ coverUrl: 'https://covers.openlibrary.org/b/id/42-M.jpg' })).toBe('unknown');
    expect(bookSource({})).toBe('unknown');
  });

  it('does not merge a different title into an untagged saved book', () => {
    expect(isBookDetailCompatible({ title: 'Old work' }, { title: 'Another work' })).toBe(false);
    expect(isBookDetailCompatible({ title: ' Old   work ' }, { title: 'old work' })).toBe(true);
    expect(isBookDetailCompatible({ title: 'Old work', workKey: 'hardcover-12' }, { title: 'Updated work' })).toBe(true);
  });

  it('prefers full Hardcover detail data while preserving values missing from details', () => {
    const result = mergeBookDetails(9, {
      title: 'Old title', authorNames: ['Search author'], coverUrl: 'https://images.example.com/old.jpg',
      isbn: '1234567890123', pageCount: 111, firstPublishYear: 2001, ratingsAverage: 4, ratingsCount: 2,
    }, {
      title: 'Detail title', authorNames: ['Detail author'], coverUrl: null, pageCount: 300,
      subjects: ['Fiction'], description: 'Description', ratingsAverage: 4.7, ratingsCount: 70,
      sourceUrl: 'https://hardcover.app/books/detail-title',
    });
    expect(result).toMatchObject({
      title: 'Detail title', authorNames: ['Detail author'], coverUrl: 'https://images.example.com/old.jpg',
      isbn: '1234567890123', pageCount: 300, firstPublishYear: 2001, ratingsAverage: 4.7,
      ratingsCount: 70, subjects: ['Fiction'], description: 'Description',
      sourceUrl: 'https://hardcover.app/books/detail-title',
    });
  });
});

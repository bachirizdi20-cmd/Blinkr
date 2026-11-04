import { describe, expect, it } from 'vitest';
import { mergeProfileMediaItems, type ProfileMediaItem, type ProfileMediaStatus } from '../lib/profile-media';

const makeStatus = (overrides: Partial<ProfileMediaStatus>): ProfileMediaStatus => ({
  mediaType: 'movie',
  mediaId: 1,
  title: 'فيلم',
  posterPath: null,
  status: 'watched',
  updatedAt: '2026-11-04T10:00:00.000Z',
  ...overrides,
});

describe('profile media status merging', () => {
  it('adds server watchlist and in-progress statuses without duplicating library items', () => {
    const library: ProfileMediaItem[] = [
      { mediaType: 'book', mediaId: 42, title: 'كتاب محفوظ', posterPath: null, addedAt: 100 },
    ];
    const statuses = [
      makeStatus({ mediaType: 'tv', mediaId: 2, title: 'مسلسل قيد المشاهدة', status: 'watching' }),
      makeStatus({ mediaType: 'book', mediaId: 42, title: 'كتاب محفوظ', status: 'watchlist' }),
      makeStatus({ mediaType: 'movie', mediaId: 3, title: 'فيلم مكتمل', status: 'watched' }),
      makeStatus({ mediaType: 'game', mediaId: 4, title: 'لعبة', status: 'watchlist' }),
    ];

    const result = mergeProfileMediaItems(library, statuses, ['watchlist', 'watching']);
    expect(result.map((item) => `${item.mediaType}:${item.mediaId}`)).toEqual(['tv:2', 'book:42']);
  });

  it('adds watched books and films to completed items only once', () => {
    const diary: ProfileMediaItem[] = [
      { mediaType: 'movie', mediaId: 1, title: 'فيلم', posterPath: null, createdAt: 10 },
    ];
    const statuses = [
      makeStatus({ mediaType: 'movie', mediaId: 1, title: 'فيلم', status: 'watched' }),
      makeStatus({ mediaType: 'book', mediaId: 42, title: 'رواية مقروءة', status: 'watched' }),
      makeStatus({ mediaType: 'tv', mediaId: 2, title: 'مسلسل قيد المشاهدة', status: 'watching' }),
    ];

    const result = mergeProfileMediaItems(diary, statuses, ['watched']);
    expect(result.map((item) => `${item.mediaType}:${item.mediaId}`)).toEqual(['book:42', 'movie:1']);
  });
});

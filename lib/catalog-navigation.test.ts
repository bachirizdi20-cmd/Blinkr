import { describe, expect, it, vi } from 'vitest';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ContentStackParamList } from '../navigation/types';
import { catalogPosterUrl, openCatalogItem } from './catalog-navigation';

vi.mock('./tmdb', () => ({ posterUrl: (path: string | null, size: string) => path ? `https://image.tmdb.org/t/p/${size}${path}` : null }));

describe('Hardcover book images and navigation', () => {
  it('accepts Hardcover covers and rejects Open Library or TMDB paths for books', () => {
    expect(catalogPosterUrl('book', 'https://assets.hardcover.app/cover.jpg')).toBe('https://assets.hardcover.app/cover.jpg');
    expect(catalogPosterUrl('book', 'https://covers.openlibrary.org/b/id/42-M.jpg')).toBeNull();
    expect(catalogPosterUrl('book', '/not-a-book-cover.jpg')).toBeNull();
    expect(catalogPosterUrl('movie', '/poster.jpg', 'w200')).toBe('https://image.tmdb.org/t/p/w200/poster.jpg');
  });

  it('opens books through Hardcover details without inventing another provider key', () => {
    const navigate = vi.fn();
    const nav = { navigate } as unknown as NativeStackNavigationProp<ContentStackParamList>;
    openCatalogItem(nav, { mediaType: 'book', mediaId: 123, title: 'Hardcover book', posterPath: 'https://assets.hardcover.app/cover.jpg' });
    expect(navigate).toHaveBeenLastCalledWith('BookDetail', { workId: 123, book: { workId: 123, title: 'Hardcover book', coverUrl: 'https://assets.hardcover.app/cover.jpg' } });
    openCatalogItem(nav, { mediaType: 'book', mediaId: 123 });
    expect(navigate).toHaveBeenLastCalledWith('BookDetail', { workId: 123, book: undefined });
    openCatalogItem(nav, { mediaType: 'movie', mediaId: 42 });
    expect(navigate).toHaveBeenLastCalledWith('Detail', { mediaType: 'movie', id: 42 });
  });
});

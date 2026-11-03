import { describe, expect, it } from 'vitest';
import { isAnimeItem } from '../lib/media-categories';

describe('TMDB anime classification', () => {
  it('requires both the animation genre and Japanese original language', () => {
    expect(isAnimeItem([16, 18], 'ja')).toBe(true);
    expect(isAnimeItem([16], 'en')).toBe(false);
    expect(isAnimeItem([18], 'ja')).toBe(false);
    expect(isAnimeItem(undefined, 'ja')).toBe(false);
    expect(isAnimeItem([16], undefined)).toBe(false);
  });
});

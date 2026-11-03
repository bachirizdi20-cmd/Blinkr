export const TMDB_ANIME_GENRE_ID = 16;

export function isAnimeItem(genreIds: readonly number[] | undefined, originalLanguage: string | null | undefined) {
  return Boolean(genreIds?.includes(TMDB_ANIME_GENRE_ID) && originalLanguage === 'ja');
}

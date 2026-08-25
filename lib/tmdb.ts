import {
  RawMovie,
  RawTV,
  NormalizedItem,
  DetailResult,
  Genre,
  SeasonDetail,
  MediaType,
} from '../types/tmdb';
import { createTRPCClient } from '@/lib/trpc';

const tmdbClient = createTRPCClient();
export const IMG_BASE = 'https://image.tmdb.org/t/p/';

export const posterUrl = (path: string | null, size: 'w200' | 'w342' | 'w500' = 'w342') =>
  path ? `${IMG_BASE}${size}${path}` : null;

export const backdropUrl = (path: string | null, size: 'w780' | 'w1280' | 'original' = 'w780') =>
  path ? `${IMG_BASE}${size}${path}` : null;

export const profileUrl = (path: string | null, size: 'w185' = 'w185') =>
  path ? `${IMG_BASE}${size}${path}` : null;

async function tmdbGet<T = any>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
  return (await tmdbClient.tmdb.get.query({ path, params })) as T;
}

const ANIME_GENRE_ID = 16;

function isAnimeItem(genreIds: number[], originalLanguage: string) {
  return genreIds.includes(ANIME_GENRE_ID) && originalLanguage === 'ja';
}

export function normalizeMovie(m: RawMovie): NormalizedItem {
  const genreIds = m.genre_ids ?? m.genres?.map((g) => g.id) ?? [];
  return {
    id: m.id,
    mediaType: 'movie',
    title: m.title,
    overview: m.overview,
    posterPath: m.poster_path,
    backdropPath: m.backdrop_path,
    date: m.release_date,
    voteAverage: m.vote_average,
    voteCount: m.vote_count,
    genreIds,
    originalLanguage: m.original_language,
    isAnime: isAnimeItem(genreIds, m.original_language),
  };
}

export function normalizeTV(t: RawTV): NormalizedItem {
  const genreIds = t.genre_ids ?? t.genres?.map((g) => g.id) ?? [];
  return {
    id: t.id,
    mediaType: 'tv',
    title: t.name,
    overview: t.overview,
    posterPath: t.poster_path,
    backdropPath: t.backdrop_path,
    date: t.first_air_date,
    voteAverage: t.vote_average,
    voteCount: t.vote_count,
    genreIds,
    originalLanguage: t.original_language,
    isAnime: isAnimeItem(genreIds, t.original_language),
  };
}

function normalizeAny(item: any): NormalizedItem | null {
  const mt = item.media_type ?? (item.title ? 'movie' : item.name ? 'tv' : null);
  if (mt === 'movie') return normalizeMovie(item);
  if (mt === 'tv') return normalizeTV(item);
  return null;
}

export interface FeedPage {
  results: NormalizedItem[];
  page: number;
  totalPages: number;
}

export async function fetchTrendingAll(page = 1): Promise<FeedPage> {
  const data = await tmdbGet('/trending/all/day', { page });
  return {
    results: data.results.map(normalizeAny).filter(Boolean) as NormalizedItem[],
    page: data.page,
    totalPages: Math.min(data.total_pages, 500),
  };
}

export async function fetchMovieList(
  list: 'popular' | 'top_rated' | 'now_playing' | 'upcoming',
  page = 1
): Promise<FeedPage> {
  const data = await tmdbGet(`/movie/${list}`, { page });
  return {
    results: data.results.map(normalizeMovie),
    page: data.page,
    totalPages: Math.min(data.total_pages, 500),
  };
}

export async function fetchTVList(
  list: 'popular' | 'top_rated' | 'on_the_air' | 'airing_today',
  page = 1
): Promise<FeedPage> {
  const data = await tmdbGet(`/tv/${list}`, { page });
  return {
    results: data.results.map(normalizeTV),
    page: data.page,
    totalPages: Math.min(data.total_pages, 500),
  };
}

export async function fetchAnime(kind: 'movie' | 'tv', page = 1): Promise<FeedPage> {
  const data = await tmdbGet(`/discover/${kind}`, {
    page,
    with_genres: ANIME_GENRE_ID,
    with_original_language: 'ja',
    sort_by: 'popularity.desc',
  });
  return {
    results: data.results.map(kind === 'movie' ? normalizeMovie : normalizeTV),
    page: data.page,
    totalPages: Math.min(data.total_pages, 500),
  };
}

export async function fetchGenreList(kind: 'movie' | 'tv', genreId: number, page = 1): Promise<FeedPage> {
  const data = await tmdbGet(`/discover/${kind}`, {
    page,
    with_genres: genreId,
    sort_by: 'popularity.desc',
  });
  return {
    results: data.results.map(kind === 'movie' ? normalizeMovie : normalizeTV),
    page: data.page,
    totalPages: Math.min(data.total_pages, 500),
  };
}

export async function fetchGenres(kind: 'movie' | 'tv'): Promise<Genre[]> {
  const data = await tmdbGet(`/genre/${kind}/list`);
  return data.genres;
}

export async function searchMulti(query: string, page = 1): Promise<FeedPage> {
  if (!query.trim()) return { results: [], page: 1, totalPages: 0 };
  const data = await tmdbGet('/search/multi', { query, page, include_adult: 'false' });
  return {
    results: data.results.map(normalizeAny).filter(Boolean) as NormalizedItem[],
    page: data.page,
    totalPages: Math.min(data.total_pages, 500),
  };
}

export async function fetchDetail(mediaType: MediaType, id: number): Promise<DetailResult> {
  const data = await tmdbGet(`/${mediaType}/${id}`, {
    append_to_response: 'credits,videos,similar',
  });
  const base = mediaType === 'movie' ? normalizeMovie(data) : normalizeTV(data);
  const cast = (data.credits?.cast ?? []).slice(0, 20);
  const crew = (data.credits?.crew ?? []).filter((c: any) =>
    ['Director', 'Creator', 'Executive Producer', 'Writer'].includes(c.job)
  );
  const videos = (data.videos?.results ?? []).filter((v: any) => v.site === 'YouTube');
  const similar = (data.similar?.results ?? [])
    .map((s: any) => (mediaType === 'movie' ? normalizeMovie(s) : normalizeTV(s)))
    .slice(0, 20);

  return {
    ...base,
    genres: data.genres ?? [],
    runtimeMinutes: mediaType === 'movie' ? data.runtime ?? null : data.episode_run_time?.[0] ?? null,
    tagline: data.tagline ?? '',
    status: data.status ?? '',
    cast,
    crew,
    videos,
    similar,
    seasons: mediaType === 'tv' ? data.seasons ?? [] : [],
    numberOfSeasons: data.number_of_seasons ?? 0,
    numberOfEpisodes: data.number_of_episodes ?? 0,
  };
}

export async function fetchSeasonDetail(tvId: number, seasonNumber: number): Promise<SeasonDetail> {
  const data = await tmdbGet(`/tv/${tvId}/season/${seasonNumber}`);
  return data;
}

export async function fetchPersonCredits(personId: number) {
  const data = await tmdbGet(`/person/${personId}/combined_credits`);
  const items = (data.cast ?? [])
    .map((c: any) => normalizeAny({ ...c, media_type: c.media_type }))
    .filter(Boolean) as NormalizedItem[];
  return items;
}

export async function fetchPersonDetail(personId: number) {
  return tmdbGet(`/person/${personId}`);
}

export type FeedDescriptor =
  | { kind: 'trending' }
  | { kind: 'movieList'; list: 'popular' | 'top_rated' | 'now_playing' | 'upcoming' }
  | { kind: 'tvList'; list: 'popular' | 'top_rated' | 'on_the_air' | 'airing_today' }
  | { kind: 'anime'; media: 'movie' | 'tv' }
  | { kind: 'genre'; media: 'movie' | 'tv'; genreId: number };

export async function fetchFeedPage(descriptor: FeedDescriptor, page: number): Promise<FeedPage> {
  switch (descriptor.kind) {
    case 'trending':
      return fetchTrendingAll(page);
    case 'movieList':
      return fetchMovieList(descriptor.list, page);
    case 'tvList':
      return fetchTVList(descriptor.list, page);
    case 'anime':
      return fetchAnime(descriptor.media, page);
    case 'genre':
      return fetchGenreList(descriptor.media, descriptor.genreId, page);
  }
}

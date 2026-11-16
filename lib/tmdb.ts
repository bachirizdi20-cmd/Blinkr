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
import { resolveMediaUrl } from './media-url';
import { isAnimeItem, TMDB_ANIME_GENRE_ID } from './media-categories';

const tmdbClient = createTRPCClient();
const tmdbMemoryCache = new Map<string, { expiresAt: number; value: unknown }>();
const tmdbPending = new Map<string, Promise<unknown>>();
const TRENDING_CACHE_TTL_MS = 15 * 60 * 1000;
const DETAIL_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function readTmdbCache<T>(key: string): T | null {
  const entry = tmdbMemoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    tmdbMemoryCache.delete(key);
    return null;
  }
  tmdbMemoryCache.delete(key);
  tmdbMemoryCache.set(key, entry);
  return entry.value as T;
}

function writeTmdbCache(key: string, value: unknown, ttl: number): void {
  if (tmdbMemoryCache.size >= 100 && !tmdbMemoryCache.has(key)) {
    const oldest = tmdbMemoryCache.keys().next().value;
    if (oldest) tmdbMemoryCache.delete(oldest);
  }
  tmdbMemoryCache.set(key, { value, expiresAt: Date.now() + ttl });
}

export function getCachedTrendingAll(page = 1): FeedPage | null {
  return readTmdbCache<FeedPage>(`trending-all:${page}`);
}

export const IMG_BASE = 'https://image.tmdb.org/t/p/';

export const posterUrl = (path: string | null, size: 'w200' | 'w342' | 'w500' = 'w342') =>
  path ? `${IMG_BASE}${size}${path}` : null;

export const backdropUrl = (path: string | null, size: 'w780' | 'w1280' | 'original' = 'w780') =>
  path ? `${IMG_BASE}${size}${path}` : null;

export const profileUrl = (path: string | null, size: 'w185' = 'w185') =>
  path
    ? (/^https?:\/\//i.test(path) || /^\/manus-storage\//i.test(path)
      ? resolveMediaUrl(path) ?? null
      : `${IMG_BASE}${size}${path}`)
    : null;

async function tmdbGet<T = any>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
  return (await tmdbClient.tmdb.get.query({ path, params })) as T;
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

export async function fetchTrendingAll(page = 1, forceRefresh = false): Promise<FeedPage> {
  const key = `trending-all:${page}`;
  if (!forceRefresh) {
    const cached = readTmdbCache<FeedPage>(key);
    if (cached) return cached;
  }
  const pending = tmdbPending.get(key);
  if (pending && !forceRefresh) return pending as Promise<FeedPage>;
  const request = (async () => {
    const data = await tmdbGet('/trending/all/day', { page });
    const result: FeedPage = {
      results: data.results.map(normalizeAny).filter(Boolean) as NormalizedItem[],
      page: data.page,
      totalPages: Math.min(data.total_pages, 500),
    };
    writeTmdbCache(key, result, TRENDING_CACHE_TTL_MS);
    return result;
  })();
  tmdbPending.set(key, request);
  try {
    return await request;
  } finally {
    if (tmdbPending.get(key) === request) tmdbPending.delete(key);
  }
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
    with_genres: TMDB_ANIME_GENRE_ID,
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
  return fetchDiscover(kind, { genreId }, page);
}

export type DiscoverFilters = {
  genreId?: number;
  year?: number;
  minRating?: number;
  maxRating?: number;
};

export async function fetchDiscover(kind: 'movie' | 'tv', filters: DiscoverFilters = {}, page = 1): Promise<FeedPage> {
  const params: Record<string, string | number | boolean> = {
    page,
    sort_by: 'popularity.desc',
    include_adult: false,
  };
  if (filters.genreId) params.with_genres = filters.genreId;
  if (filters.minRating !== undefined) params['vote_average.gte'] = filters.minRating;
  if (filters.maxRating !== undefined) params['vote_average.lte'] = filters.maxRating;
  if (filters.year && kind === 'movie') params.primary_release_year = filters.year;
  if (filters.year && kind === 'tv') params.first_air_date_year = filters.year;

  const data = await tmdbGet(`/discover/${kind}`, params);
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

export interface ReviewPage {
  results: import('../types/tmdb').TMDBReview[];
  page: number;
  totalPages: number;
  totalResults: number;
}

function mapReview(review: any) {
  return {
    id: String(review.id),
    author: review.author ?? 'TMDB user',
    authorUsername: review.author_details?.username ?? '',
    authorAvatarPath: review.author_details?.avatar_path ?? null,
    rating: typeof review.author_details?.rating === 'number' ? review.author_details.rating : null,
    content: review.content ?? '',
    createdAt: review.created_at ?? '',
    updatedAt: review.updated_at ?? review.created_at ?? '',
    url: review.url ?? '',
  };
}

export async function fetchReviews(mediaType: MediaType, id: number, page = 1): Promise<ReviewPage> {
  const data = await tmdbGet(`/${mediaType}/${id}/reviews`, { page });
  return {
    results: (data.results ?? []).map(mapReview),
    page: data.page ?? page,
    totalPages: Math.min(data.total_pages ?? 1, 20),
    totalResults: data.total_results ?? 0,
  };
}

export async function fetchDetail(mediaType: MediaType, id: number): Promise<DetailResult> {
  const cacheKey = `detail:${mediaType}:${id}`;
  const cached = readTmdbCache<DetailResult>(cacheKey);
  if (cached) return cached;
  const pending = tmdbPending.get(cacheKey);
  if (pending) return pending as Promise<DetailResult>;
  const request = (async (): Promise<DetailResult> => {
  let data: any;
  try {
    // TMDB's appended resources can occasionally fail as a group. Retry the
    // core title endpoint so a valid film/series page is not lost with them.
    data = await tmdbGet(`/${mediaType}/${id}`, {
      append_to_response: 'credits,videos,similar,reviews',
    });
  } catch (appendError) {
    try {
      data = await tmdbGet(`/${mediaType}/${id}`);
    } catch {
      throw appendError;
    }
  }
  const base = mediaType === 'movie' ? normalizeMovie(data) : normalizeTV(data);
  const cast = (data.credits?.cast ?? []).slice(0, 20);
  const crew = (data.credits?.crew ?? []).filter((c: any) =>
    ['Director', 'Creator', 'Executive Producer', 'Writer'].includes(c.job)
  );
  const videos = (data.videos?.results ?? []).filter((v: any) => v.site === 'YouTube');
  const similar = (data.similar?.results ?? [])
    .map((s: any) => (mediaType === 'movie' ? normalizeMovie(s) : normalizeTV(s)))
    .slice(0, 20);
  const reviews = (data.reviews?.results ?? []).slice(0, 8).map(mapReview);

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
    reviews,
  };
  })();
  tmdbPending.set(cacheKey, request);
  try {
    const result = await request;
    writeTmdbCache(cacheKey, result, DETAIL_CACHE_TTL_MS);
    return result;
  } finally {
    if (tmdbPending.get(cacheKey) === request) tmdbPending.delete(cacheKey);
  }
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

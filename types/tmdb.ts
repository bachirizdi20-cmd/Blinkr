export type MediaType = 'movie' | 'tv';

export interface Genre {
  id: number;
  name: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface Video {
  id: string;
  key: string;
  site: string;
  type: string;
  name: string;
}

export interface SeasonSummary {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  poster_path: string | null;
  air_date: string | null;
  overview: string;
}

export interface Episode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  air_date: string | null;
  still_path: string | null;
  vote_average: number;
  runtime: number | null;
}

export interface SeasonDetail {
  id: number;
  name: string;
  overview: string;
  season_number: number;
  air_date: string | null;
  poster_path: string | null;
  episodes: Episode[];
}

export interface RawMovie {
  id: number;
  title: string;
  original_title?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids?: number[];
  genres?: Genre[];
  original_language: string;
  runtime?: number;
  tagline?: string;
  status?: string;
  media_type?: string;
}

export interface RawTV {
  id: number;
  name: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids?: number[];
  genres?: Genre[];
  original_language: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  episode_run_time?: number[];
  seasons?: SeasonSummary[];
  tagline?: string;
  status?: string;
  media_type?: string;
}

export interface NormalizedItem {
  id: number;
  mediaType: MediaType;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  date: string;
  voteAverage: number;
  voteCount: number;
  genreIds: number[];
  originalLanguage: string;
  isAnime: boolean;
}

export interface DetailResult extends NormalizedItem {
  genres: Genre[];
  runtimeMinutes: number | null;
  tagline: string;
  status: string;
  cast: CastMember[];
  crew: CrewMember[];
  videos: Video[];
  similar: NormalizedItem[];
  seasons: SeasonSummary[];
  numberOfSeasons: number;
  numberOfEpisodes: number;
}

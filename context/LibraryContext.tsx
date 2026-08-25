import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MediaType } from '../types/tmdb';

export interface MediaRef {
  mediaType: MediaType;
  mediaId: number;
  title: string;
  posterPath: string | null;
  date?: string;
  genreIds?: number[];
  voteAverage?: number;
}

export const mediaKey = (mediaType: MediaType, mediaId: number) => `${mediaType}-${mediaId}`;

export interface DiaryEntry extends MediaRef {
  id: string;
  watchedDate: string; // YYYY-MM-DD
  rating?: number; // 0.5 - 5
  review?: string;
  rewatch: boolean;
  spoiler: boolean;
  createdAt: number;
}

export interface UserList {
  id: string;
  name: string;
  description: string;
  items: MediaRef[];
  createdAt: number;
}

export interface UserProfile {
  username: string;
  bio: string;
  avatarColor: string;
  joinedAt: number;
}

interface WatchlistMap { [key: string]: MediaRef & { addedAt: number } }
interface LikesMap { [key: string]: MediaRef & { likedAt: number } }
interface EpisodeWatchedMap { [key: string]: boolean }

const KEYS = {
  watchlist: '@reelog/watchlist',
  diary: '@reelog/diary',
  likes: '@reelog/likes',
  lists: '@reelog/lists',
  profile: '@reelog/profile',
  episodes: '@reelog/episodes',
};

const AVATAR_COLORS = ['#33D6A6', '#FF9F43', '#4EA8DE', '#FF5C7A', '#B48CFF', '#FFC94D'];

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

interface LibraryContextValue {
  loaded: boolean;
  watchlist: WatchlistMap;
  likes: LikesMap;
  diary: DiaryEntry[];
  lists: UserList[];
  profile: UserProfile;
  episodeWatched: EpisodeWatchedMap;

  isInWatchlist: (mediaType: MediaType, mediaId: number) => boolean;
  toggleWatchlist: (item: MediaRef) => void;

  isLiked: (mediaType: MediaType, mediaId: number) => boolean;
  toggleLike: (item: MediaRef) => void;

  getDiaryForMedia: (mediaType: MediaType, mediaId: number) => DiaryEntry[];
  getLatestRating: (mediaType: MediaType, mediaId: number) => number | undefined;
  isWatched: (mediaType: MediaType, mediaId: number) => boolean;
  setQuickRating: (item: MediaRef, rating: number) => void;
  toggleWatchedQuick: (item: MediaRef) => void;
  addDiaryEntry: (entry: Omit<DiaryEntry, 'id' | 'createdAt'>) => string;
  updateDiaryEntry: (id: string, patch: Partial<DiaryEntry>) => void;
  deleteDiaryEntry: (id: string) => void;

  createList: (name: string, description: string) => string;
  deleteList: (id: string) => void;
  renameList: (id: string, name: string, description: string) => void;
  toggleItemInList: (listId: string, item: MediaRef) => void;
  isItemInList: (listId: string, mediaType: MediaType, mediaId: number) => boolean;

  updateProfile: (patch: Partial<UserProfile>) => void;

  toggleEpisodeWatched: (tvId: number, season: number, episode: number) => void;
  isEpisodeWatched: (tvId: number, season: number, episode: number) => boolean;
  markSeasonWatched: (tvId: number, season: number, episodeNumbers: number[], watched: boolean) => void;

  stats: {
    filmsWatched: number;
    showsWatched: number;
    totalLogged: number;
    avgRating: number;
    thisYear: number;
    genreTally: Record<number, number>;
  };
}

const LibraryContext = createContext<LibraryContextValue | undefined>(undefined);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [watchlist, setWatchlist] = useState<WatchlistMap>({});
  const [likes, setLikes] = useState<LikesMap>({});
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [lists, setLists] = useState<UserList[]>([]);
  const [episodeWatched, setEpisodeWatched] = useState<EpisodeWatchedMap>({});
  const [profile, setProfile] = useState<UserProfile>({
    username: 'cinephile',
    bio: 'Tracking everything I watch.',
    avatarColor: AVATAR_COLORS[0],
    joinedAt: Date.now(),
  });

  useEffect(() => {
    (async () => {
      try {
        const [w, d, l, li, p, e] = await Promise.all([
          AsyncStorage.getItem(KEYS.watchlist),
          AsyncStorage.getItem(KEYS.diary),
          AsyncStorage.getItem(KEYS.lists),
          AsyncStorage.getItem(KEYS.likes),
          AsyncStorage.getItem(KEYS.profile),
          AsyncStorage.getItem(KEYS.episodes),
        ]);
        if (w) setWatchlist(JSON.parse(w));
        if (d) setDiary(JSON.parse(d));
        if (l) setLists(JSON.parse(l));
        if (li) setLikes(JSON.parse(li));
        if (p) setProfile(JSON.parse(p));
        if (e) setEpisodeWatched(JSON.parse(e));
      } catch (err) {
        console.warn('Failed to load library', err);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => { if (loaded) AsyncStorage.setItem(KEYS.watchlist, JSON.stringify(watchlist)); }, [watchlist, loaded]);
  useEffect(() => { if (loaded) AsyncStorage.setItem(KEYS.diary, JSON.stringify(diary)); }, [diary, loaded]);
  useEffect(() => { if (loaded) AsyncStorage.setItem(KEYS.lists, JSON.stringify(lists)); }, [lists, loaded]);
  useEffect(() => { if (loaded) AsyncStorage.setItem(KEYS.likes, JSON.stringify(likes)); }, [likes, loaded]);
  useEffect(() => { if (loaded) AsyncStorage.setItem(KEYS.profile, JSON.stringify(profile)); }, [profile, loaded]);
  useEffect(() => { if (loaded) AsyncStorage.setItem(KEYS.episodes, JSON.stringify(episodeWatched)); }, [episodeWatched, loaded]);

  const isInWatchlist = useCallback((mediaType: MediaType, mediaId: number) => !!watchlist[mediaKey(mediaType, mediaId)], [watchlist]);

  const toggleWatchlist = useCallback((item: MediaRef) => {
    const key = mediaKey(item.mediaType, item.mediaId);
    setWatchlist((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = { ...item, addedAt: Date.now() };
      return next;
    });
  }, []);

  const isLiked = useCallback((mediaType: MediaType, mediaId: number) => !!likes[mediaKey(mediaType, mediaId)], [likes]);

  const toggleLike = useCallback((item: MediaRef) => {
    const key = mediaKey(item.mediaType, item.mediaId);
    setLikes((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = { ...item, likedAt: Date.now() };
      return next;
    });
  }, []);

  const getDiaryForMedia = useCallback(
    (mediaType: MediaType, mediaId: number) =>
      diary
        .filter((e) => e.mediaType === mediaType && e.mediaId === mediaId)
        .sort((a, b) => b.createdAt - a.createdAt),
    [diary]
  );

  const getLatestRating = useCallback(
    (mediaType: MediaType, mediaId: number) => {
      const entries = diary
        .filter((e) => e.mediaType === mediaType && e.mediaId === mediaId && e.rating)
        .sort((a, b) => b.createdAt - a.createdAt);
      return entries[0]?.rating;
    },
    [diary]
  );

  const isWatched = useCallback(
    (mediaType: MediaType, mediaId: number) => diary.some((e) => e.mediaType === mediaType && e.mediaId === mediaId),
    [diary]
  );

  const addDiaryEntry = useCallback((entry: Omit<DiaryEntry, 'id' | 'createdAt'>) => {
    const id = uid();
    setDiary((prev) => [{ ...entry, id, createdAt: Date.now() }, ...prev]);
    return id;
  }, []);

  const updateDiaryEntry = useCallback((id: string, patch: Partial<DiaryEntry>) => {
    setDiary((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const deleteDiaryEntry = useCallback((id: string) => {
    setDiary((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const setQuickRating = useCallback((item: MediaRef, rating: number) => {
    setDiary((prev) => {
      const existingIdx = prev.findIndex((e) => e.mediaType === item.mediaType && e.mediaId === item.mediaId);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], rating };
        return next;
      }
      const today = new Date().toISOString().slice(0, 10);
      return [
        {
          ...item,
          id: uid(),
          watchedDate: today,
          rating,
          rewatch: false,
          spoiler: false,
          createdAt: Date.now(),
        },
        ...prev,
      ];
    });
  }, []);

  const toggleWatchedQuick = useCallback((item: MediaRef) => {
    setDiary((prev) => {
      const has = prev.some((e) => e.mediaType === item.mediaType && e.mediaId === item.mediaId);
      if (has) return prev.filter((e) => !(e.mediaType === item.mediaType && e.mediaId === item.mediaId));
      const today = new Date().toISOString().slice(0, 10);
      return [
        { ...item, id: uid(), watchedDate: today, rewatch: false, spoiler: false, createdAt: Date.now() },
        ...prev,
      ];
    });
  }, []);

  const createList = useCallback((name: string, description: string) => {
    const id = uid();
    setLists((prev) => [{ id, name, description, items: [], createdAt: Date.now() }, ...prev]);
    return id;
  }, []);

  const deleteList = useCallback((id: string) => {
    setLists((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const renameList = useCallback((id: string, name: string, description: string) => {
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, name, description } : l)));
  }, []);

  const toggleItemInList = useCallback((listId: string, item: MediaRef) => {
    setLists((prev) =>
      prev.map((l) => {
        if (l.id !== listId) return l;
        const exists = l.items.some((i) => i.mediaType === item.mediaType && i.mediaId === item.mediaId);
        return {
          ...l,
          items: exists
            ? l.items.filter((i) => !(i.mediaType === item.mediaType && i.mediaId === item.mediaId))
            : [item, ...l.items],
        };
      })
    );
  }, []);

  const isItemInList = useCallback(
    (listId: string, mediaType: MediaType, mediaId: number) => {
      const list = lists.find((l) => l.id === listId);
      return !!list?.items.some((i) => i.mediaType === mediaType && i.mediaId === mediaId);
    },
    [lists]
  );

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleEpisodeWatched = useCallback((tvId: number, season: number, episode: number) => {
    const key = `${tvId}-s${season}e${episode}`;
    setEpisodeWatched((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const isEpisodeWatched = useCallback(
    (tvId: number, season: number, episode: number) => !!episodeWatched[`${tvId}-s${season}e${episode}`],
    [episodeWatched]
  );

  const markSeasonWatched = useCallback((tvId: number, season: number, episodeNumbers: number[], watched: boolean) => {
    setEpisodeWatched((prev) => {
      const next = { ...prev };
      episodeNumbers.forEach((ep) => {
        const key = `${tvId}-s${season}e${ep}`;
        if (watched) next[key] = true;
        else delete next[key];
      });
      return next;
    });
  }, []);

  const stats = useMemo(() => {
    const filmsWatched = new Set(diary.filter((e) => e.mediaType === 'movie').map((e) => e.mediaId)).size;
    const showsWatched = new Set(diary.filter((e) => e.mediaType === 'tv').map((e) => e.mediaId)).size;
    const rated = diary.filter((e) => typeof e.rating === 'number');
    const avgRating = rated.length ? rated.reduce((s, e) => s + (e.rating ?? 0), 0) / rated.length : 0;
    const thisYearNum = new Date().getFullYear();
    const thisYear = diary.filter((e) => e.watchedDate?.slice(0, 4) === String(thisYearNum)).length;
    const genreTally: Record<number, number> = {};
    diary.forEach((e) => (e.genreIds ?? []).forEach((g) => (genreTally[g] = (genreTally[g] ?? 0) + 1)));
    return { filmsWatched, showsWatched, totalLogged: diary.length, avgRating, thisYear, genreTally };
  }, [diary]);

  const value: LibraryContextValue = {
    loaded,
    watchlist,
    likes,
    diary,
    lists,
    profile,
    episodeWatched,
    isInWatchlist,
    toggleWatchlist,
    isLiked,
    toggleLike,
    getDiaryForMedia,
    getLatestRating,
    isWatched,
    setQuickRating,
    toggleWatchedQuick,
    addDiaryEntry,
    updateDiaryEntry,
    deleteDiaryEntry,
    createList,
    deleteList,
    renameList,
    toggleItemInList,
    isItemInList,
    updateProfile,
    toggleEpisodeWatched,
    isEpisodeWatched,
    markSeasonWatched,
    stats,
  };

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}

export { AVATAR_COLORS };

import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchGenres } from '../lib/tmdb';
import { Genre } from '../types/tmdb';

interface MetadataContextValue {
  movieGenres: Genre[];
  tvGenres: Genre[];
  genreName: (id: number) => string | undefined;
}

const MetadataContext = createContext<MetadataContextValue>({
  movieGenres: [],
  tvGenres: [],
  genreName: () => undefined,
});

export function MetadataProvider({ children }: { children: React.ReactNode }) {
  const [movieGenres, setMovieGenres] = useState<Genre[]>([]);
  const [tvGenres, setTvGenres] = useState<Genre[]>([]);

  useEffect(() => {
    fetchGenres('movie').then(setMovieGenres).catch(() => {});
    fetchGenres('tv').then(setTvGenres).catch(() => {});
  }, []);

  const genreName = (id: number) =>
    movieGenres.find((g) => g.id === id)?.name ?? tvGenres.find((g) => g.id === id)?.name;

  return (
    <MetadataContext.Provider value={{ movieGenres, tvGenres, genreName }}>{children}</MetadataContext.Provider>
  );
}

export function useMetadata() {
  return useContext(MetadataContext);
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SectionRow from '../components/SectionRow';
import ApiErrorState from '../components/ApiErrorState';
import { ContentStackParamList } from '../navigation/types';
import {
  fetchTrendingAll,
  fetchMovieList,
  fetchTVList,
  fetchAnime,
  backdropUrl,
} from '../lib/tmdb';
import { NormalizedItem } from '../types/tmdb';
import { useMetadata } from '../context/MetadataContext';
import { colors, fontSizes, spacing, radius } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type Category = 'all' | 'movie' | 'tv' | 'anime';

const { width: SCREEN_W } = Dimensions.get('window');

interface SectionData {
  key: string;
  title: string;
  subtitle?: string;
  data: NormalizedItem[];
  loading: boolean;
  seeAll: () => void;
  categories: Category[];
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { movieGenres } = useMetadata();
  const [category, setCategory] = useState<Category>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [trending, setTrending] = useState<NormalizedItem[]>([]);
  const [moviePopular, setMoviePopular] = useState<NormalizedItem[]>([]);
  const [movieTop, setMovieTop] = useState<NormalizedItem[]>([]);
  const [movieUpcoming, setMovieUpcoming] = useState<NormalizedItem[]>([]);
  const [movieNowPlaying, setMovieNowPlaying] = useState<NormalizedItem[]>([]);
  const [tvPopular, setTvPopular] = useState<NormalizedItem[]>([]);
  const [tvTop, setTvTop] = useState<NormalizedItem[]>([]);
  const [tvAiring, setTvAiring] = useState<NormalizedItem[]>([]);
  const [animeTv, setAnimeTv] = useState<NormalizedItem[]>([]);
  const [animeMovie, setAnimeMovie] = useState<NormalizedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [t, mp, mt, mu, mn, tp, tt, ta, at, am] = await Promise.all([
        fetchTrendingAll(1),
        fetchMovieList('popular', 1),
        fetchMovieList('top_rated', 1),
        fetchMovieList('upcoming', 1),
        fetchMovieList('now_playing', 1),
        fetchTVList('popular', 1),
        fetchTVList('top_rated', 1),
        fetchTVList('airing_today', 1),
        fetchAnime('tv', 1),
        fetchAnime('movie', 1),
      ]);
      setTrending(t.results);
      setMoviePopular(mp.results);
      setMovieTop(mt.results);
      setMovieUpcoming(mu.results);
      setMovieNowPlaying(mn.results);
      setTvPopular(tp.results);
      setTvTop(tt.results);
      setTvAiring(ta.results);
      setAnimeTv(at.results);
      setAnimeMovie(am.results);
    } catch (err) {
      console.warn(err);
      setError(err instanceof Error ? err.message : 'Unable to reach TMDB right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const openDetail = (item: NormalizedItem) => {
    navigation.navigate('Detail', { mediaType: item.mediaType, id: item.id });
  };

  const hero = trending[0];

  const sections: SectionData[] = useMemo(
    () => [
      {
        key: 'movie_popular',
        title: 'Popular Movies',
        data: moviePopular,
        loading,
        categories: ['all', 'movie'],
        seeAll: () => navigation.navigate('CategoryList', { title: 'Popular Movies', feed: { kind: 'movieList', list: 'popular' } }),
      },
      {
        key: 'tv_popular',
        title: 'Popular TV Shows',
        data: tvPopular,
        loading,
        categories: ['all', 'tv'],
        seeAll: () => navigation.navigate('CategoryList', { title: 'Popular TV Shows', feed: { kind: 'tvList', list: 'popular' } }),
      },
      {
        key: 'anime_tv',
        title: 'Popular Anime Series',
        data: animeTv,
        loading,
        categories: ['all', 'anime'],
        seeAll: () => navigation.navigate('CategoryList', { title: 'Popular Anime Series', feed: { kind: 'anime', media: 'tv' } }),
      },
      {
        key: 'now_playing',
        title: 'In Theaters',
        data: movieNowPlaying,
        loading,
        categories: ['all', 'movie'],
        seeAll: () => navigation.navigate('CategoryList', { title: 'In Theaters', feed: { kind: 'movieList', list: 'now_playing' } }),
      },
      {
        key: 'anime_movie',
        title: 'Anime Movies',
        data: animeMovie,
        loading,
        categories: ['anime'],
        seeAll: () => navigation.navigate('CategoryList', { title: 'Anime Movies', feed: { kind: 'anime', media: 'movie' } }),
      },
      {
        key: 'movie_top',
        title: 'Top Rated Movies',
        data: movieTop,
        loading,
        categories: ['all', 'movie'],
        seeAll: () => navigation.navigate('CategoryList', { title: 'Top Rated Movies', feed: { kind: 'movieList', list: 'top_rated' } }),
      },
      {
        key: 'tv_top',
        title: 'Top Rated TV Shows',
        data: tvTop,
        loading,
        categories: ['tv'],
        seeAll: () => navigation.navigate('CategoryList', { title: 'Top Rated TV Shows', feed: { kind: 'tvList', list: 'top_rated' } }),
      },
      {
        key: 'tv_airing',
        title: 'Airing Today',
        data: tvAiring,
        loading,
        categories: ['tv'],
        seeAll: () => navigation.navigate('CategoryList', { title: 'Airing Today', feed: { kind: 'tvList', list: 'airing_today' } }),
      },
      {
        key: 'upcoming',
        title: 'Upcoming Movies',
        data: movieUpcoming,
        loading,
        categories: ['all', 'movie'],
        seeAll: () => navigation.navigate('CategoryList', { title: 'Upcoming Movies', feed: { kind: 'movieList', list: 'upcoming' } }),
      },
    ],
    [moviePopular, tvPopular, animeTv, movieNowPlaying, animeMovie, movieTop, tvTop, tvAiring, movieUpcoming, loading]
  );

  const visibleSections = sections.filter((s) => s.categories.includes(category));

  const genreChips = movieGenres.slice(0, 10);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Reelog</Text>
            <Text style={styles.tagline}>Track every story you watch</Text>
          </View>
          <Pressable style={styles.searchBtn} onPress={() => navigation.navigate('Search')}>
            <Ionicons name="search" size={20} color={colors.text} />
          </Pressable>
        </View>

        {hero && (
          <Pressable style={styles.hero} onPress={() => openDetail(hero)}>
            <Image source={{ uri: backdropUrl(hero.backdropPath, 'w1280') ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={['transparent', 'rgba(6,8,11,0.55)', colors.bg]} style={StyleSheet.absoluteFill} />
            <View style={styles.heroContent}>
              <View style={styles.trendingTag}>
                <Ionicons name="flame" size={12} color={colors.accent2} />
                <Text style={styles.trendingTagText}>Trending Today</Text>
              </View>
              <Text style={styles.heroTitle} numberOfLines={2}>{hero.title}</Text>
              <View style={styles.heroMetaRow}>
                <Ionicons name="star" size={13} color={colors.gold} />
                <Text style={styles.heroMetaText}>{hero.voteAverage.toFixed(1)}</Text>
                <Text style={styles.heroDot}>•</Text>
                <Text style={styles.heroMetaText}>{hero.date?.slice(0, 4)}</Text>
                <Text style={styles.heroDot}>•</Text>
                <Text style={styles.heroMetaText}>{hero.mediaType === 'movie' ? 'Movie' : 'TV Series'}</Text>
              </View>
            </View>
          </Pressable>
        )}

        <View style={styles.categoryRow}>
          {(['all', 'movie', 'tv', 'anime'] as Category[]).map((c) => (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              style={[styles.categoryPill, category === c && styles.categoryPillActive]}
            >
              <Text style={[styles.categoryText, category === c && styles.categoryTextActive]}>
                {c === 'all' ? 'All' : c === 'movie' ? 'Movies' : c === 'tv' ? 'TV' : 'Anime'}
              </Text>
            </Pressable>
          ))}
        </View>

        {category === 'all' && genreChips.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreScroll} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {genreChips.map((g) => (
              <Pressable
                key={g.id}
                style={styles.genreChip}
                onPress={() => navigation.navigate('CategoryList', { title: g.name, feed: { kind: 'genre', media: 'movie', genreId: g.id } })}
              >
                <Text style={styles.genreChipText}>{g.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {error ? (
          <ApiErrorState message={error} onRetry={load} />
        ) : (
          visibleSections.map((s) => (
          <SectionRow
            key={s.key}
            title={s.title}
            data={s.data}
            loading={s.loading}
            onSeeAll={s.seeAll}
            onItemPress={openDetail}
          />
          ))
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  brand: { color: colors.text, fontSize: fontSizes.xxl, fontWeight: '800', letterSpacing: 0.3 },
  tagline: { color: colors.textDim, fontSize: fontSizes.xs, marginTop: 2 },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  hero: {
    width: SCREEN_W - spacing.lg * 2,
    height: 220,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  heroContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg },
  trendingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(10,13,18,0.6)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  trendingTagText: { color: colors.accent2, fontSize: 11, fontWeight: '700' },
  heroTitle: { color: colors.text, fontSize: fontSizes.xxl, fontWeight: '800' },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  heroMetaText: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '600' },
  heroDot: { color: colors.textFaint },
  categoryRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  categoryPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  categoryText: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '700' },
  categoryTextActive: { color: '#04120C' },
  genreScroll: { marginBottom: spacing.lg },
  genreChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  genreChipText: { color: colors.text, fontSize: fontSizes.xs, fontWeight: '600' },
});

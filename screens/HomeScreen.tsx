import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Dimensions,
  TextInput,
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
  posterUrl,
} from '../lib/tmdb';
import { NormalizedItem } from '../types/tmdb';
import { useMetadata } from '../context/MetadataContext';
import { useSocial } from '../context/SocialContext';
import { SocialReview } from '../types/social';
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

        <SocialReviewFeed onOpenDetail={(review) => navigation.navigate('Detail', { mediaType: review.mediaType, id: review.mediaId })} />

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

function SocialReviewFeed({ onOpenDetail }: { onOpenDetail: (review: SocialReview) => void }) {
  const { reviews, users, isFollowing, toggleReviewLike, addReviewComment } = useSocial();
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const followedReviews = reviews
    .filter((review) => isFollowing(review.userId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 6);

  const submitComment = (reviewId: string) => {
    if (!commentText.trim()) return;
    addReviewComment(reviewId, commentText);
    setCommentText('');
    setActiveCommentId(null);
  };

  return (
    <View style={styles.socialSection}>
      <View style={styles.socialSectionHeader}>
        <View>
          <Text style={styles.socialTitle}>From people you follow</Text>
          <Text style={styles.socialSubtitle}>Fresh thoughts from your circle</Text>
        </View>
        <Ionicons name="people-outline" size={19} color={colors.accent} />
      </View>
      {followedReviews.length === 0 ? (
        <View style={styles.socialEmpty}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.textFaint} />
          <Text style={styles.socialEmptyTitle}>No reviews from your circle yet</Text>
          <Text style={styles.socialEmptyText}>Follow more people to see their latest thoughts here.</Text>
        </View>
      ) : (
        followedReviews.map((review) => {
          const user = users.find((item) => item.id === review.userId);
          const poster = posterUrl(review.posterPath, 'w342');
          return (
            <View key={review.id} style={styles.socialCard}>
              <View style={styles.socialCardHeader}>
                <View style={[styles.socialAvatar, { backgroundColor: user?.avatarColor ?? colors.accent }]}>
                  <Text style={styles.socialAvatarText}>{user?.displayName?.slice(0, 1) ?? '?'}</Text>
                </View>
                <View style={styles.socialAuthorBlock}>
                  <Text style={styles.socialAuthor}>{user?.displayName ?? 'A friend'}</Text>
                  <Text style={styles.socialHandle}>@{user?.username ?? 'friend'} · {formatSocialTime(review.createdAt)}</Text>
                </View>
                <View style={styles.socialRating}><Ionicons name="star" size={13} color={colors.gold} /><Text style={styles.socialRatingText}>{review.rating}/10</Text></View>
              </View>
              <Pressable style={styles.socialMediaRow} onPress={() => onOpenDetail(review)}>
                {poster ? <Image source={{ uri: poster }} style={styles.socialPoster} contentFit="cover" /> : <View style={[styles.socialPoster, styles.socialPosterFallback]}><Ionicons name="film-outline" size={20} color={colors.textFaint} /></View>}
                <View style={styles.socialMediaInfo}><Text style={styles.socialMediaTitle} numberOfLines={2}>{review.title}</Text><Text style={styles.socialMediaHint}>Tap to open details</Text></View>
              </Pressable>
              <Text style={styles.socialReviewText}>{review.text}</Text>
              <View style={styles.socialActions}>
                <Pressable style={styles.socialAction} onPress={() => toggleReviewLike(review.id)} accessibilityLabel={review.likedByMe ? 'Unlike review' : 'Like review'}>
                  <Ionicons name={review.likedByMe ? 'heart' : 'heart-outline'} size={20} color={review.likedByMe ? colors.danger : colors.textDim} />
                  <Text style={[styles.socialActionText, review.likedByMe && { color: colors.danger }]}>{review.likes}</Text>
                </Pressable>
                <Pressable style={styles.socialAction} onPress={() => setActiveCommentId(activeCommentId === review.id ? null : review.id)} accessibilityLabel="Comment on review">
                  <Ionicons name="chatbubble-outline" size={19} color={colors.textDim} />
                  <Text style={styles.socialActionText}>{review.comments.length}</Text>
                </Pressable>
              </View>
              {review.comments.slice(-2).map((comment) => (
                <View key={comment.id} style={styles.commentRow}><Text style={styles.commentAuthor}>{comment.authorName}</Text><Text style={styles.commentBody}>{comment.text}</Text></View>
              ))}
              {activeCommentId === review.id && (
                <View style={styles.commentComposer}>
                  <TextInput
                    value={commentText}
                    onChangeText={setCommentText}
                    placeholder="Write a comment..."
                    placeholderTextColor={colors.textFaint}
                    style={styles.commentInput}
                    returnKeyType="send"
                    onSubmitEditing={() => submitComment(review.id)}
                  />
                  <Pressable style={styles.commentSend} onPress={() => submitComment(review.id)} accessibilityLabel="Post comment">
                    <Ionicons name="arrow-up" size={16} color={colors.bg} />
                  </Pressable>
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

function formatSocialTime(value: number) {
  const minutes = Math.max(1, Math.round((Date.now() - value) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
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
  socialSection: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  socialSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  socialTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '800' },
  socialSubtitle: { color: colors.textFaint, fontSize: fontSizes.xs, marginTop: 2 },
  socialEmpty: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  socialEmptyTitle: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '800', marginTop: spacing.sm },
  socialEmptyText: { color: colors.textDim, fontSize: fontSizes.xs, textAlign: 'center', marginTop: 4 },
  socialCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  socialCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  socialAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  socialAvatarText: { color: colors.bg, fontSize: fontSizes.md, fontWeight: '800' },
  socialAuthorBlock: { flex: 1 },
  socialAuthor: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '800' },
  socialHandle: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  socialRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  socialRatingText: { color: colors.gold, fontSize: fontSizes.sm, fontWeight: '800' },
  socialMediaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  socialPoster: { width: 46, height: 68, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh },
  socialPosterFallback: { alignItems: 'center', justifyContent: 'center' },
  socialMediaInfo: { flex: 1 },
  socialMediaTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '800' },
  socialMediaHint: { color: colors.accent, fontSize: 11, marginTop: 4, fontWeight: '700' },
  socialReviewText: { color: colors.textDim, fontSize: fontSizes.sm, lineHeight: 20, marginTop: spacing.md },
  socialActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.md, paddingTop: spacing.sm },
  socialAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  socialActionText: { color: colors.textDim, fontSize: fontSizes.xs, fontWeight: '700' },
  commentRow: { flexDirection: 'row', gap: 5, marginTop: spacing.xs, backgroundColor: colors.surfaceHigh, borderRadius: radius.sm, padding: spacing.sm },
  commentAuthor: { color: colors.text, fontSize: 11, fontWeight: '800' },
  commentBody: { color: colors.textDim, flex: 1, fontSize: 11, lineHeight: 16 },
  commentComposer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  commentInput: { flex: 1, minHeight: 38, color: colors.text, backgroundColor: colors.bg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: fontSizes.sm },
  commentSend: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});

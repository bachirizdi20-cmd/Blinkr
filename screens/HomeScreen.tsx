import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
  Pressable,
  Dimensions,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SectionRow from '../components/SectionRow';
import BookCard from '../components/BookCard';
import ApiErrorState from '../components/ApiErrorState';
import { ContentStackParamList } from '../navigation/types';
import {
  fetchTrendingAll,
  fetchMovieList,
  fetchTVList,
  fetchAnime,
  backdropUrl,
} from '../lib/tmdb';
import { NormalizedItem, ReviewMediaType } from '../types/tmdb';
import { catalogPosterUrl, openCatalogItem } from '../lib/catalog-navigation';
import { useMetadata } from '../context/MetadataContext';
import { useAuth } from '../hooks/use-auth';
import { trpc } from '../lib/trpc';
import { colors, fontSizes, spacing, radius } from '../lib/theme';
import { resolveMediaUrl } from '../lib/media-url';
import { BookSummary } from '../types/books';

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
  const { user } = useAuth();
  const { movieGenres } = useMetadata();
  const notificationsQuery = trpc.social.notifications.useQuery(undefined, { enabled: Boolean(user) });
  const hardcoverTrendingQuery = trpc.books.trending.useQuery({ limit: 100 }, { retry: 1 });
  const unreadNotifications = (notificationsQuery.data ?? []).filter((item) => !item.readAt).length;
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
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
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
      const setters: ((items: NormalizedItem[]) => void)[] = [
        setTrending, setMoviePopular, setMovieTop, setMovieUpcoming, setMovieNowPlaying,
        setTvPopular, setTvTop, setTvAiring, setAnimeTv, setAnimeMovie,
      ];
      const failures: unknown[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') setters[index](result.value.results);
        else failures.push(result.reason);
      });
      if (failures.length === results.length) setError('تعذر تحميل العناوين الآن. اسحب الشاشة لإعادة المحاولة.');
      else if (failures.length) setError('تعذر تحميل بعض الأقسام؛ ستبقى الأقسام المتاحة ظاهرة. اسحب الشاشة لإعادة المحاولة.');
    } catch {
      setError('تعذر الاتصال بخدمة العناوين الآن.');
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
    void hardcoverTrendingQuery.refetch();
  };

  const openDetail = (item: NormalizedItem) => {
    navigation.navigate('Detail', { mediaType: item.mediaType, id: item.id });
  };

  const hero = trending[0];

  const sections: SectionData[] = useMemo(
    () => [
      {
        key: 'movie_popular',
        title: 'الأفلام الرائجة',
        data: moviePopular,
        loading,
        categories: ['all', 'movie'],
        seeAll: () => navigation.navigate('CategoryList', { title: 'الأفلام الرائجة', feed: { kind: 'movieList', list: 'popular' } }),
      },
      {
        key: 'tv_popular',
        title: 'المسلسلات الرائجة',
        data: tvPopular,
        loading,
        categories: ['all', 'tv'],
        seeAll: () => navigation.navigate('CategoryList', { title: 'المسلسلات الرائجة', feed: { kind: 'tvList', list: 'popular' } }),
      },
      {
        key: 'anime_tv',
        title: 'مسلسلات الأنمي الرائجة',
        data: animeTv,
        loading,
        categories: ['all', 'anime'],
        seeAll: () => navigation.navigate('CategoryList', { title: 'مسلسلات الأنمي الرائجة', feed: { kind: 'anime', media: 'tv' } }),
      },
      {
        key: 'now_playing',
        title: 'في دور العرض',
        data: movieNowPlaying,
        loading,
        categories: ['all', 'movie'],
        seeAll: () => navigation.navigate('CategoryList', { title: 'في دور العرض', feed: { kind: 'movieList', list: 'now_playing' } }),
      },
      {
        key: 'anime_movie',
        title: 'أفلام أنمي',
        data: animeMovie,
        loading,
        categories: ['anime'],
        seeAll: () => navigation.navigate('CategoryList', { title: 'أفلام أنمي', feed: { kind: 'anime', media: 'movie' } }),
      },
      {
        key: 'movie_top',
        title: 'الأفلام الأعلى تقييمًا',
        data: movieTop,
        loading,
        categories: ['all', 'movie'],
        seeAll: () => navigation.navigate('CategoryList', { title: 'الأفلام الأعلى تقييمًا', feed: { kind: 'movieList', list: 'top_rated' } }),
      },
      {
        key: 'tv_top',
        title: 'المسلسلات الأعلى تقييمًا',
        data: tvTop,
        loading,
        categories: ['tv'],
        seeAll: () => navigation.navigate('CategoryList', { title: 'المسلسلات الأعلى تقييمًا', feed: { kind: 'tvList', list: 'top_rated' } }),
      },
      {
        key: 'tv_airing',
        title: 'يُعرض اليوم',
        data: tvAiring,
        loading,
        categories: ['tv'],
        seeAll: () => navigation.navigate('CategoryList', { title: 'يُعرض اليوم', feed: { kind: 'tvList', list: 'airing_today' } }),
      },
      {
        key: 'upcoming',
        title: 'أفلام قادمة',
        data: movieUpcoming,
        loading,
        categories: ['all', 'movie'],
        seeAll: () => navigation.navigate('CategoryList', { title: 'أفلام قادمة', feed: { kind: 'movieList', list: 'upcoming' } }),
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
            <Text style={styles.brand}>Blinkr</Text>
            <Text style={styles.tagline}>تابع كل قصة تشاهدها</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.searchBtn} onPress={() => navigation.navigate('Notifications')} accessibilityRole="button" accessibilityLabel="الإشعارات">
              <Ionicons name="notifications-outline" size={20} color={colors.text} />
              {unreadNotifications > 0 ? <View style={styles.notificationDot}><Text style={styles.notificationCount}>{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text></View> : null}
            </Pressable>
            <Pressable style={styles.searchBtn} onPress={() => navigation.navigate('Search')} accessibilityRole="button" accessibilityLabel="البحث">
              <Ionicons name="search" size={20} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {hero && (
          <Pressable style={styles.hero} onPress={() => openDetail(hero)} accessibilityRole="button" accessibilityLabel={`Trending today: ${hero.title}`}>
            <Image source={{ uri: backdropUrl(hero.backdropPath, 'w1280') ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={['transparent', 'rgba(6,8,11,0.55)', colors.bg]} style={StyleSheet.absoluteFill} />
            <View style={styles.heroContent}>
              <View style={styles.trendingTag}>
                <Ionicons name="flame" size={12} color={colors.accent2} />
                <Text style={styles.trendingTagText}>الرائج اليوم</Text>
              </View>
              <Text style={styles.heroTitle} numberOfLines={2}>{hero.title}</Text>
              <View style={styles.heroMetaRow}>
                <Ionicons name="star" size={13} color={colors.gold} />
                <Text style={styles.heroMetaText}>{hero.voteAverage.toFixed(1)}</Text>
                <Text style={styles.heroDot}>•</Text>
                <Text style={styles.heroMetaText}>{hero.date?.slice(0, 4)}</Text>
                <Text style={styles.heroDot}>•</Text>
                <Text style={styles.heroMetaText}>{hero.mediaType === 'movie' ? 'فيلم' : 'مسلسل'}</Text>
              </View>
            </View>
          </Pressable>
        )}

        <View style={styles.categoryRow}>
          {(['all', 'movie', 'tv', 'anime'] as Category[]).map((c) => (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              accessibilityRole="button"
              accessibilityState={{ selected: category === c }}
              accessibilityLabel={c === 'all' ? 'All categories' : c === 'movie' ? 'Movies' : c === 'tv' ? 'TV' : 'Anime'}
              style={[styles.categoryPill, category === c && styles.categoryPillActive]}
            >
              <Text style={[styles.categoryText, category === c && styles.categoryTextActive]}>
                {c === 'all' ? 'الكل' : c === 'movie' ? 'الأفلام' : c === 'tv' ? 'المسلسلات' : 'الأنمي'}
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

        <SocialReviewFeed onOpenDetail={(review) => openCatalogItem(navigation, review)} enabled={Boolean(user)} />

        <View style={styles.bookSection}>
          <View style={styles.bookSectionHeader}>
            <View><Text style={styles.bookSectionTitle}>الكتب الرائجة عالميًا</Text><Text style={styles.bookSectionSubtitle}>أشهر الكتب الرائجة حول العالم</Text></View>
            <Pressable onPress={() => navigation.navigate('Search', { booksTrending: true })} accessibilityRole="button"><Text style={styles.bookSectionMore}>الكل</Text></Pressable>
          </View>
          {hardcoverTrendingQuery.isLoading ? <View style={styles.bookLoading}><Text style={styles.bookLoadingText}>جارٍ تحميل الكتب…</Text></View> : hardcoverTrendingQuery.isError ? <Pressable onPress={() => hardcoverTrendingQuery.refetch()} style={styles.bookError}><Text style={styles.bookErrorText}>تعذر تحميل كتب Hardcover — اضغط لإعادة المحاولة.</Text></Pressable> : <FlatList
            data={((hardcoverTrendingQuery.data ?? []) as BookSummary[]).filter((book) => Boolean(book.coverUrl))}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(book) => `hardcover-${book.workId}`}
            contentContainerStyle={styles.bookList}
            ListEmptyComponent={<View style={styles.bookLoading}><Text style={styles.bookLoadingText}>لا توجد كتب رائجة بأغلفة متاحة حاليًا.</Text></View>}
            renderItem={({ item }) => <BookCard book={item} width={112} onPress={() => navigation.navigate('BookDetail', { workId: item.workId, book: item })} />}
          />}
        </View>

        {error ? <ApiErrorState message={error} onRetry={load} /> : null}
        {visibleSections.map((s) => (
          <SectionRow
            key={s.key}
            title={s.title}
            data={s.data}
            loading={s.loading}
            onSeeAll={s.seeAll}
            onItemPress={openDetail}
          />
        ))}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}


type FeedRow = {
  review: { id: number; userId: number; mediaType: ReviewMediaType; mediaId: number; title: string; posterPath: string | null; rating: number; review: string; createdAt: string | Date };
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

function SocialReviewFeed({ onOpenDetail, enabled }: { onOpenDetail: (review: { mediaType: ReviewMediaType; mediaId: number; title: string; posterPath: string | null }) => void; enabled: boolean }) {
  const [showAllReviews, setShowAllReviews] = useState(false);
  const feedQuery = trpc.social.feed.useQuery(undefined, { enabled });
  const rows = (feedQuery.data ?? []) as FeedRow[];
  const visibleRows = showAllReviews ? rows : rows.slice(0, 3);

  return (
    <View style={styles.socialSection}>
      <View style={styles.socialSectionHeader}>
        <View>
          <Text style={styles.socialTitle}>من تتابعهم</Text>
          <Text style={styles.socialSubtitle}>أحدث آراء دائرتك</Text>
        </View>
        {rows.length > 3 ? (
          <Pressable style={styles.socialMoreButton} onPress={() => setShowAllReviews((current) => !current)} accessibilityRole="button">
            <Text style={styles.socialMoreText}>{showAllReviews ? 'عرض أقل' : 'عرض المزيد'}</Text>
            <Ionicons name={showAllReviews ? 'chevron-up' : 'chevron-down'} size={15} color={colors.accent} />
          </Pressable>
        ) : <Ionicons name="people-outline" size={19} color={colors.accent} />}
      </View>
      {feedQuery.isError ? (
        <ApiErrorState message="تعذر تحميل موجز مراجعاتك." onRetry={() => feedQuery.refetch()} />
      ) : rows.length === 0 ? (
        <View style={styles.socialEmpty}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.textFaint} />
          <Text style={styles.socialEmptyTitle}>لا توجد مراجعات جديدة بعد</Text>
          <Text style={styles.socialEmptyText}>تابع أشخاصًا آخرين لتظهر آراؤهم هنا.</Text>
        </View>
      ) : (
        visibleRows.map((row, index) => (
          <FeedReviewCard
            key={row.review.id}
            row={row}
            index={index}
            onOpenDetail={onOpenDetail}
            onChanged={() => feedQuery.refetch()}
          />
        ))
      )}
    </View>
  );
}

function FeedReviewCard({
  row,
  index,
  onOpenDetail,
  onChanged,
}: {
  row: FeedRow;
  index: number;
    onOpenDetail: (review: { mediaType: ReviewMediaType; mediaId: number; title: string; posterPath: string | null }) => void;
  onChanged: () => void;
}) {
  const { review, username, displayName, avatarUrl, likeCount, commentCount, likedByMe } = row;
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const commentsQuery = trpc.social.comments.useQuery({ reviewId: review.id }, { enabled: commentOpen });
  const toggleLikeMutation = trpc.social.toggleLike.useMutation({ onSuccess: onChanged });
  const addCommentMutation = trpc.social.addComment.useMutation({
    onSuccess: () => { setCommentText(''); commentsQuery.refetch(); onChanged(); },
  });

  const submitComment = () => {
    if (!commentText.trim()) return;
    addCommentMutation.mutate({ reviewId: review.id, text: commentText.trim() });
  };

  const poster = catalogPosterUrl(review.mediaType, review.posterPath, 'w342');
  const createdAtMs = new Date(review.createdAt).getTime();

  return (
    <Animated.View
      style={styles.socialCard}
      entering={index >= 3 ? FadeInDown.duration(240).withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] }) : undefined}
      exiting={index >= 3 ? FadeOutUp.duration(180) : undefined}
    >
      <View style={styles.socialCardHeader}>
        <View style={[styles.socialAvatar, { backgroundColor: colors.accent }]}>
          {resolveMediaUrl(avatarUrl) ? (
            <Image source={{ uri: resolveMediaUrl(avatarUrl) }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          ) : (
            <Text style={styles.socialAvatarText}>{(displayName ?? username ?? '?').slice(0, 1)}</Text>
          )}
        </View>
        <View style={styles.socialAuthorBlock}>
          <Text style={styles.socialAuthor}>{displayName ?? username ?? 'مستخدم'}</Text>
          <Text style={styles.socialHandle}>@{username ?? 'مستخدم'} · {formatSocialTime(createdAtMs)}</Text>
        </View>
        <View style={styles.socialRating}><Ionicons name="star" size={13} color={colors.gold} /><Text style={styles.socialRatingText}>{review.rating}/10</Text></View>
      </View>
      <Pressable style={styles.socialMediaRow} onPress={() => onOpenDetail({ mediaType: review.mediaType, mediaId: review.mediaId, title: review.title, posterPath: review.posterPath })}>
        {poster ? <Image source={{ uri: poster }} style={styles.socialPoster} contentFit="cover" /> : <View style={[styles.socialPoster, styles.socialPosterFallback]}><Ionicons name={review.mediaType === 'book' ? 'book-outline' : 'film-outline'} size={20} color={colors.textFaint} /></View>}
        <View style={styles.socialMediaInfo}><Text style={styles.socialMediaTitle} numberOfLines={2}>{review.title}</Text><Text style={styles.socialMediaHint}>اضغط لفتح التفاصيل</Text></View>
      </Pressable>
      <Text style={styles.socialReviewText}>{review.review}</Text>
      <View style={styles.socialActions}>
        <Pressable style={styles.socialAction} onPress={() => toggleLikeMutation.mutate({ reviewId: review.id })} accessibilityRole="button" accessibilityLabel={likedByMe ? 'إلغاء الإعجاب بالمراجعة' : 'الإعجاب بالمراجعة'}>
          <Ionicons name={likedByMe ? 'heart' : 'heart-outline'} size={20} color={likedByMe ? colors.danger : colors.textDim} />
          <Text style={[styles.socialActionText, likedByMe && { color: colors.danger }]}>{likeCount}</Text>
        </Pressable>
        <Pressable style={styles.socialAction} onPress={() => setCommentOpen((current) => !current)} accessibilityRole="button" accessibilityLabel="التعليق على المراجعة">
          <Ionicons name="chatbubble-outline" size={19} color={colors.textDim} />
          <Text style={styles.socialActionText}>{commentCount}</Text>
        </Pressable>
      </View>
      {commentOpen && (commentsQuery.data ?? []).slice(0, 2).map((item) => (
        <View key={item.comment.id} style={styles.commentRow}>
          <Text style={styles.commentAuthor}>{item.name ?? item.username ?? 'مستخدم'}</Text>
          <Text style={styles.commentBody}>{item.comment.text}</Text>
        </View>
      ))}
      {commentOpen && (
        <View style={styles.commentComposer}>
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder="اكتب تعليقًا…"
            placeholderTextColor={colors.textFaint}
            selectionColor={colors.accent}
            cursorColor={colors.accent}
            style={styles.commentInput}
            returnKeyType="send"
            onSubmitEditing={submitComment}
          />
          <Pressable style={styles.commentSend} onPress={submitComment} accessibilityRole="button" accessibilityLabel="إرسال التعليق">
            <Ionicons name="arrow-up" size={16} color={colors.bg} />
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

function formatSocialTime(value: number) {
  const minutes = Math.max(1, Math.round((Date.now() - value) / 60000));
  if (minutes < 60) return minutes === 1 ? 'قبل دقيقة' : `قبل ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'قبل ساعة' : `قبل ${hours} ساعة`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'قبل يوم' : `قبل ${days} يوم`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  notificationDot: { position: 'absolute' as const, top: -5, right: -5, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.danger, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 3 },
  notificationCount: { color: '#fff', fontSize: 9, fontWeight: '800' as const },
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
  socialMoreButton: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  socialMoreText: { color: colors.accent, fontSize: fontSizes.xs, fontWeight: '800' },
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
  bookSection: { marginBottom: spacing.lg },
  bookSectionHeader: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bookSectionTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '900' },
  bookSectionSubtitle: { color: colors.textFaint, fontSize: fontSizes.xs, marginTop: 3 },
  bookSectionMore: { color: colors.accent, fontSize: fontSizes.sm, fontWeight: '800' },
  bookList: { paddingHorizontal: spacing.lg, gap: spacing.md },
  bookLoading: { height: 180, alignItems: 'center', justifyContent: 'center' },
  bookLoadingText: { color: colors.textFaint, fontSize: fontSizes.sm },
  bookError: { marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
  bookErrorText: { color: colors.accent, fontSize: fontSizes.sm },
});

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
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
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SectionRow from '../components/SectionRow';
import SectionHeader from '../components/SectionHeader';
import ComicCard from '../components/ComicCard';
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
import { useAuth } from '../hooks/use-auth';
import { trpc } from '../lib/trpc';
import { colors, fontSizes, spacing, radius } from '../lib/theme';
import { resolveMediaUrl } from '../lib/media-url';
import { ComicSummary } from '../types/comics';
import { BookSummary } from '../types/books';
import { PlatformAlert as Alert } from '../lib/platform-alert';
import { readPersistentCache, writePersistentCache } from '../lib/persistent-cache';

type Nav = NativeStackNavigationProp<ContentStackParamList>;

const { width: SCREEN_W } = Dimensions.get('window');

interface SectionData {
  key: string;
  title: string;
  subtitle?: string;
  data: NormalizedItem[];
  loading: boolean;
  seeAll: () => void;
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const comicTrendingQuery = trpc.comics.trending.useQuery({ limit: 20 }, { retry: 1, staleTime: 10 * 60 * 1000 });
  const bookTrendingQuery = trpc.books.trending.useQuery({ limit: 20 }, { retry: 1, staleTime: 10 * 60 * 1000 });
  const [refreshing, setRefreshing] = useState(false);
  const [feedRefreshToken, setFeedRefreshToken] = useState(0);
  const [cachedTrending, setCachedTrending] = useState<NormalizedItem[]>([]);
  const [cachedBooks, setCachedBooks] = useState<BookSummary[]>([]);
  const [cachedComics, setCachedComics] = useState<ComicSummary[]>([]);
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

  useEffect(() => {
    void Promise.all([
      readPersistentCache<NormalizedItem[]>('home:trending').then((value) => { if (value?.length) setCachedTrending(value); }),
      readPersistentCache<BookSummary[]>('home:books').then((value) => { if (value?.length) setCachedBooks(value); }),
      readPersistentCache<ComicSummary[]>('home:comics').then((value) => { if (value?.length) setCachedComics(value); }),
    ]);
  }, []);

  useEffect(() => { if (trending.length) void writePersistentCache('home:trending', trending); }, [trending]);
  useEffect(() => {
    if (bookTrendingQuery.data?.length) {
      const books = bookTrendingQuery.data as BookSummary[];
      setCachedBooks(books);
      void writePersistentCache('home:books', books);
    }
  }, [bookTrendingQuery.data]);
  useEffect(() => {
    if (comicTrendingQuery.data?.length) {
      const comics = comicTrendingQuery.data as ComicSummary[];
      setCachedComics(comics);
      void writePersistentCache('home:comics', comics);
    }
  }, [comicTrendingQuery.data]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const applyBatch = (results: PromiseSettledResult<{ results: NormalizedItem[] }>[], setters: ((items: NormalizedItem[]) => void)[]) => {
      let failures = 0;
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') setters[index](result.value.results);
        else failures += 1;
      });
      return failures;
    };
    try {
      // Render the first two catalog rows as soon as their essential data arrives.
      const primary = await Promise.allSettled([
        fetchMovieList('popular', 1),
        fetchTVList('popular', 1),
        fetchTrendingAll(1),
      ]);
      const primaryFailures = applyBatch(primary, [setMoviePopular, setTvPopular, (items) => setTrending(items)]);

      // Load secondary collections after the primary rows are ready, avoiding a
      // ten-request burst that delays the first useful content on slower phones.
      const secondary = await Promise.allSettled([
        fetchMovieList('top_rated', 1),
        fetchMovieList('upcoming', 1),
        fetchMovieList('now_playing', 1),
        fetchTVList('top_rated', 1),
        fetchTVList('airing_today', 1),
        fetchAnime('tv', 1),
        fetchAnime('movie', 1),
      ]);
      const secondaryFailures = applyBatch(secondary, [
        setMovieTop, setMovieUpcoming, setMovieNowPlaying, setTvTop, setTvAiring, setAnimeTv, setAnimeMovie,
      ]);
      setLoading(false);
      setRefreshing(false);
      if (primaryFailures + secondaryFailures === 10) setError('تعذر تحميل العناوين الآن. اسحب الشاشة لإعادة المحاولة.');
      else if (primaryFailures + secondaryFailures > 0) setError('تعذر تحميل بعض الأقسام؛ ستبقى الأقسام المتاحة ظاهرة. اسحب الشاشة لإعادة المحاولة.');
    } catch {
      setError('تعذر الاتصال بخدمة العناوين الآن.');
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
    void comicTrendingQuery.refetch();
    void bookTrendingQuery.refetch();
    setFeedRefreshToken((value) => value + 1);
  };

  const openDetail = (item: NormalizedItem) => {
    navigation.navigate('Detail', { mediaType: item.mediaType, id: item.id, fallback: item });
  };

  const visibleTrending = trending.length ? trending : cachedTrending;
  const bookItems = ((bookTrendingQuery.data ?? cachedBooks) as BookSummary[]).filter((book) => Boolean(book.coverUrl));
  const comicItems = ((comicTrendingQuery.data ?? cachedComics) as ComicSummary[]).filter((comic) => Boolean(comic.coverUrl));
  const hero = visibleTrending.find((item) => item.mediaType === 'movie') ?? visibleTrending[0];

  const sections: SectionData[] = useMemo(
    () => [
      {
        key: 'movie_popular',
        title: 'الأفلام الرائجة',
        data: moviePopular,
        loading,
        seeAll: () => navigation.navigate('CategoryList', { title: 'الأفلام الرائجة', feed: { kind: 'movieList', list: 'popular' } }),
      },
      {
        key: 'tv_popular',
        title: 'المسلسلات الرائجة',
        data: tvPopular,
        loading,
        seeAll: () => navigation.navigate('CategoryList', { title: 'المسلسلات الرائجة', feed: { kind: 'tvList', list: 'popular' } }),
      },
      {
        key: 'anime_tv',
        title: 'مسلسلات الأنمي الرائجة',
        data: animeTv,
        loading,
        seeAll: () => navigation.navigate('CategoryList', { title: 'مسلسلات الأنمي الرائجة', feed: { kind: 'anime', media: 'tv' } }),
      },
      {
        key: 'now_playing',
        title: 'في دور العرض',
        data: movieNowPlaying,
        loading,
        seeAll: () => navigation.navigate('CategoryList', { title: 'في دور العرض', feed: { kind: 'movieList', list: 'now_playing' } }),
      },
      {
        key: 'anime_movie',
        title: 'أفلام أنمي',
        data: animeMovie,
        loading,
        seeAll: () => navigation.navigate('CategoryList', { title: 'أفلام أنمي', feed: { kind: 'anime', media: 'movie' } }),
      },
      {
        key: 'movie_top',
        title: 'الأفلام الأعلى تقييمًا',
        data: movieTop,
        loading,
        seeAll: () => navigation.navigate('CategoryList', { title: 'الأفلام الأعلى تقييمًا', feed: { kind: 'movieList', list: 'top_rated' } }),
      },
      {
        key: 'tv_top',
        title: 'المسلسلات الأعلى تقييمًا',
        data: tvTop,
        loading,
        seeAll: () => navigation.navigate('CategoryList', { title: 'المسلسلات الأعلى تقييمًا', feed: { kind: 'tvList', list: 'top_rated' } }),
      },
      {
        key: 'tv_airing',
        title: 'يُعرض اليوم',
        data: tvAiring,
        loading,
        seeAll: () => navigation.navigate('CategoryList', { title: 'يُعرض اليوم', feed: { kind: 'tvList', list: 'airing_today' } }),
      },
      {
        key: 'upcoming',
        title: 'أفلام قادمة',
        data: movieUpcoming,
        loading,
        seeAll: () => navigation.navigate('CategoryList', { title: 'أفلام قادمة', feed: { kind: 'movieList', list: 'upcoming' } }),
      },
    ],
    [moviePopular, tvPopular, animeTv, movieNowPlaying, animeMovie, movieTop, tvTop, tvAiring, movieUpcoming, loading]
  );

  const visibleSections = sections;


  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Blinkr</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.searchBtn} onPress={() => navigation.navigate('Search')} accessibilityRole="button" accessibilityLabel="البحث">
              <Ionicons name="search" size={20} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <View style={styles.heroSection}>
          {visibleTrending.length === 0 && loading ? (
            <View style={styles.heroLoading}><ActivityIndicator color={colors.accent} size="large" /></View>
          ) : hero ? (
            <Pressable style={styles.hero} onPress={() => openDetail(hero)} accessibilityRole="button" accessibilityLabel={`فتح ${hero.title}`}>
              <Image source={{ uri: backdropUrl(hero.backdropPath, 'w1280') ?? catalogPosterUrl(hero.mediaType, hero.posterPath, 'w500') ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <LinearGradient colors={['transparent', 'rgba(6,8,11,0.55)', colors.bg]} style={StyleSheet.absoluteFill} />
              <View style={styles.heroContent}>
                <View style={styles.trendingTag}><Ionicons name="flame" size={12} color={colors.accent2} /><Text style={styles.trendingTagText}>الرائج اليوم</Text></View>
                <Text style={styles.heroTitle} numberOfLines={2}>{hero.title}</Text>
                <View style={styles.heroMetaRow}><Ionicons name="star" size={13} color={colors.gold} /><Text style={styles.heroMetaText}>{hero.voteAverage.toFixed(1)}</Text><Text style={styles.heroDot}>•</Text><Text style={styles.heroMetaText}>{hero.date?.slice(0, 4)}</Text><Text style={styles.heroDot}>•</Text><Text style={styles.heroMetaText}>{hero.mediaType === 'movie' ? 'فيلم' : 'مسلسل'}</Text></View>
              </View>
            </Pressable>
          ) : null}
        </View>

        <SocialReviewFeed enabled={Boolean(user)} refreshToken={feedRefreshToken} onOpenDetail={(item) => openCatalogItem(navigation, { mediaType: item.mediaType, mediaId: item.mediaId, title: item.title, posterPath: item.posterPath })} />

        <View style={styles.bookSection}>
          <View style={styles.bookSectionHeader}>
            <View><Text style={styles.bookSectionTitle}>الكتب الرائجة</Text><Text style={styles.bookSectionSubtitle}>{bookItems.length.toLocaleString('ar')} كتاب</Text></View>
            <Pressable onPress={() => navigation.navigate('Search', { booksTrending: true })}><Text style={styles.bookSectionMore}>عرض الكل</Text></Pressable>
          </View>
          {bookTrendingQuery.isLoading && bookItems.length === 0 ? <View style={styles.bookLoading}><ActivityIndicator color={colors.accent} size="large" /></View>
            : bookTrendingQuery.isError && bookItems.length === 0 ? <Pressable onPress={() => bookTrendingQuery.refetch()} style={styles.bookError}><Text style={styles.bookErrorText}>تعذر تحميل الكتب — اضغط لإعادة المحاولة.</Text></Pressable>
            : <FlatList data={bookItems} horizontal showsHorizontalScrollIndicator={false} keyExtractor={(book) => `book-${book.workId}`} contentContainerStyle={styles.bookList} ListEmptyComponent={<View style={styles.bookLoading}><Text style={styles.bookLoadingText}>لا توجد كتب بأغلفة متاحة حاليًا.</Text></View>} renderItem={({ item }) => <BookCard book={item} width={112} onPress={() => navigation.navigate('BookDetail', { workId: item.workId, book: item })} />} />}
        </View>

        {error ? <ApiErrorState message={error} onRetry={load} /> : null}
        {visibleSections.filter((section) => section.key === 'movie_popular' || section.key === 'tv_popular').map((s) => (
          <SectionRow key={s.key} title={s.title} data={s.data} loading={s.loading} onSeeAll={s.seeAll} onItemPress={openDetail} />
        ))}

        <View style={styles.bookSection}>
          <View style={styles.bookSectionHeader}><View><Text style={styles.bookSectionTitle}>الكوميك الرائجة</Text><Text style={styles.bookSectionSubtitle}>{comicItems.length.toLocaleString('ar')} كوميك</Text></View><Pressable onPress={() => navigation.navigate('Search', { comicsTrending: true })}><Text style={styles.bookSectionMore}>عرض الكل</Text></Pressable></View>
          {comicTrendingQuery.isLoading && comicItems.length === 0 ? <View style={styles.bookLoading}><ActivityIndicator color={colors.accent} size="large" /></View> : comicTrendingQuery.isError && comicItems.length === 0 ? <Pressable onPress={() => comicTrendingQuery.refetch()} style={styles.bookError}><Text style={styles.bookErrorText}>تعذر تحميل الكوميك — اضغط لإعادة المحاولة.</Text></Pressable> : <FlatList data={comicItems} horizontal showsHorizontalScrollIndicator={false} keyExtractor={(comic) => `comic-${comic.id}`} contentContainerStyle={styles.bookList} ListEmptyComponent={<View style={styles.bookLoading}><Text style={styles.bookLoadingText}>لا توجد كوميك بأغلفة متاحة حاليًا.</Text></View>} renderItem={({ item }) => <ComicCard comic={item} width={112} onPress={() => navigation.navigate('ComicDetail', { id: item.id, comic: item })} />} />}
        </View>

        {visibleSections.filter((section) => section.key !== 'movie_popular' && section.key !== 'tv_popular').map((s) => (
          <SectionRow key={s.key} title={s.title} data={s.data} loading={s.loading} onSeeAll={s.seeAll} onItemPress={openDetail} />
        ))}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}


export type FeedRow = {
  review: { id: number; userId: number; mediaType: ReviewMediaType; mediaId: number; mediaSource?: string | null; title: string; posterPath: string | null; rating: number; review: string; createdAt: string | Date };
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

function SocialReviewFeed({ onOpenDetail, enabled, refreshToken }: { onOpenDetail: (review: { mediaType: ReviewMediaType; mediaId: number; title: string; posterPath: string | null }) => void; enabled: boolean; refreshToken: number }) {
  const feedQuery = trpc.social.feed.useQuery(undefined, { enabled, retry: 1, staleTime: 60 * 1000 });
  useEffect(() => { if (refreshToken > 0) void feedQuery.refetch(); }, [refreshToken, feedQuery.refetch]);
  const rows = (feedQuery.data ?? []) as FeedRow[];

  return (
    <View style={styles.socialSection}>
      <SectionHeader title="مراجعات المتابعين" subtitle="آخر ما نشره الأشخاص الذين تتابعهم" />
      {!enabled ? (
        <View style={styles.socialEmpty}><Ionicons name="people-outline" size={24} color={colors.textFaint} /><Text style={styles.socialEmptyTitle}>سجّل الدخول لمتابعة المراجعات</Text><Text style={styles.socialEmptyText}>ستظهر هنا مراجعات الأشخاص الذين تتابعهم.</Text></View>
      ) : feedQuery.isLoading ? (
        <View style={styles.socialEmpty}><Text style={styles.socialEmptyText}>جارٍ تحميل المراجعات…</Text></View>
      ) : feedQuery.isError ? (
        <ApiErrorState message="تعذر تحميل مراجعات المتابعين." onRetry={() => feedQuery.refetch()} />
      ) : rows.length === 0 ? (
        <View style={styles.socialEmpty}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.textFaint} />
          <Text style={styles.socialEmptyTitle}>لا توجد مراجعات جديدة بعد</Text>
          <Text style={styles.socialEmptyText}>عندما ينشر من تتابعهم مراجعة ستظهر هنا.</Text>
        </View>
      ) : (
        <FlatList
          horizontal
          data={rows}
          keyExtractor={(row) => String(row.review.id)}
          renderItem={({ item, index }) => (
            <FeedReviewCard
              row={item}
              index={index}
              onOpenDetail={onOpenDetail}
              onChanged={() => feedQuery.refetch()}
            />
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.socialCarouselContent}
          snapToInterval={SCREEN_W - spacing.lg}
          decelerationRate="fast"
          disableIntervalMomentum
          getItemLayout={(_, index) => ({ length: SCREEN_W - spacing.lg, offset: (SCREEN_W - spacing.lg) * index, index })}
        />
      )}
    </View>
  );
}

export function FeedReviewCard({
  row,
  index,
  onOpenDetail,
  onChanged,
  isOwn = false,
  fullWidth = false,
  onEdit,
  onDelete,
}: {
  row: FeedRow;
  index: number;
  onOpenDetail: (review: { mediaType: ReviewMediaType; mediaId: number; title: string; posterPath: string | null }) => void;
  onChanged: () => void;
  isOwn?: boolean;
  fullWidth?: boolean;
  onEdit?: (review: FeedRow['review']) => void;
  onDelete?: (review: FeedRow['review']) => void;
}) {
  const { review, username, displayName, avatarUrl, likeCount, commentCount, likedByMe } = row;
  const { user } = useAuth();
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyTarget, setReplyTarget] = useState<{ id: number; name: string } | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const commentsQuery = trpc.social.comments.useQuery({ reviewId: review.id }, { enabled: commentOpen });
  const toggleLikeMutation = trpc.social.toggleLike.useMutation({ onSuccess: onChanged });
  const addCommentMutation = trpc.social.addComment.useMutation({
    onSuccess: () => { setCommentText(''); setReplyTarget(null); commentsQuery.refetch(); onChanged(); },
  });
  const updateCommentMutation = trpc.social.updateComment.useMutation({
    onSuccess: () => { setEditingCommentId(null); setEditingCommentText(''); void commentsQuery.refetch(); },
  });
  const deleteCommentMutation = trpc.social.deleteComment.useMutation({
    onSuccess: () => { void commentsQuery.refetch(); onChanged(); },
  });
  const reportMutation = trpc.social.report.useMutation({ onSuccess: () => Alert.alert('تم إرسال البلاغ', 'شكرًا، سيراجع فريق Blinkr البلاغ.') });

  const submitComment = () => {
    if (!commentText.trim()) return;
    addCommentMutation.mutate({ reviewId: review.id, text: commentText.trim(), ...(replyTarget ? { parentCommentId: replyTarget.id } : {}) });
  };

  const poster = catalogPosterUrl(review.mediaType, review.posterPath, 'w342');
  const createdAtMs = new Date(review.createdAt).getTime();
  const openReviewMenu = () => isOwn
    ? Alert.alert('خيارات المراجعة', 'اختر إجراءً', [
        { text: 'تعديل', onPress: () => onEdit?.(review) },
        { text: 'حذف', style: 'destructive', onPress: () => onDelete?.(review) },
        { text: 'إلغاء', style: 'cancel' },
      ])
    : Alert.alert('خيارات المراجعة', 'اختر إجراءً', [
        { text: 'إبلاغ', onPress: () => reportMutation.mutate({ targetType: 'review', targetId: review.id, reason: 'other' }) },
        { text: 'إلغاء', style: 'cancel' },
      ]);
  const openCommentMenu = (item: any) => {
    if (item.comment.userId === user?.id) {
      Alert.alert('خيارات التعليق', 'اختر إجراءً', [
        { text: 'تعديل التعليق', onPress: () => { setEditingCommentId(item.comment.id); setEditingCommentText(item.comment.text); } },
        { text: 'حذف التعليق', style: 'destructive', onPress: () => Alert.alert('حذف التعليق', 'هل تريد حذف هذا التعليق؟', [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'حذف', style: 'destructive', onPress: () => deleteCommentMutation.mutate({ commentId: item.comment.id }) },
        ]) },
        { text: 'إلغاء', style: 'cancel' },
      ]);
    } else {
      Alert.alert('خيارات التعليق', 'اختر إجراءً', [
        { text: 'إبلاغ', onPress: () => reportMutation.mutate({ targetType: 'comment', targetId: item.comment.id, reason: 'other' }) },
        { text: 'إلغاء', style: 'cancel' },
      ]);
    }
  };

  return (
    <Animated.View
      style={[styles.socialCard, fullWidth && styles.socialCardFullWidth]}
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
          <Text style={styles.socialHandle}>{formatSocialTime(createdAtMs)}</Text>
        </View>
        <View style={styles.socialRating}><Ionicons name="star" size={13} color={colors.gold} /><Text style={styles.socialRatingText}>{review.rating}/10</Text></View>
        <Pressable onPress={openReviewMenu} accessibilityLabel="خيارات المراجعة"><Ionicons name="ellipsis-vertical" size={20} color={colors.textDim} /></Pressable>
      </View>
      <Pressable style={styles.socialMediaRow} onPress={() => onOpenDetail({ mediaType: review.mediaType, mediaId: review.mediaId, title: review.title, posterPath: review.posterPath })}>
        {poster ? <Image source={{ uri: poster }} style={styles.socialPoster} contentFit="cover" /> : <View style={[styles.socialPoster, styles.socialPosterFallback]}><Ionicons name={review.mediaType === 'book' ? 'book-outline' : 'film-outline'} size={20} color={colors.textFaint} /></View>}
        <View style={styles.socialMediaInfo}><Text style={styles.socialMediaTitle} numberOfLines={2}>{review.title}</Text></View>
      </Pressable>
      <Text style={styles.socialReviewText}>{review.review}</Text>
      <View style={styles.socialActions}>
        <Pressable style={styles.socialAction} onPress={() => toggleLikeMutation.mutate({ reviewId: review.id })} accessibilityRole="button" accessibilityLabel={likedByMe ? 'إلغاء التفاعل مع المراجعة' : 'التفاعل مع المراجعة'}>
          <OkayHandIcon active={likedByMe} />
          <Text style={[styles.socialActionText, likedByMe && { color: colors.accent }]}>{likeCount}</Text>
        </Pressable>
        <Pressable style={styles.socialAction} onPress={() => setCommentOpen((current) => !current)} accessibilityRole="button" accessibilityLabel="التعليق على المراجعة">
          <Ionicons name="chatbubble-outline" size={19} color={colors.textDim} />
          <Text style={styles.socialActionText}>{commentCount}</Text>
        </Pressable>
      </View>
      {commentOpen && (commentsQuery.data ?? []).filter((item) => !item.comment.parentCommentId).map((item) => {
        const authorName = item.name ?? item.username ?? 'مستخدم';
        const replies = (commentsQuery.data ?? []).filter((reply) => reply.comment.parentCommentId === item.comment.id);
        const renderCommentBody = (comment: any) => editingCommentId === comment.comment.id ? (
          <View>
            <TextInput value={editingCommentText} onChangeText={setEditingCommentText} style={styles.commentEditInput} multiline maxLength={1000} textAlign="right" />
            <View style={styles.commentInlineActions}>
              <Pressable onPress={() => { setEditingCommentId(null); setEditingCommentText(''); }}><Text style={styles.replyAction}>إلغاء</Text></Pressable>
              <Pressable disabled={!editingCommentText.trim() || updateCommentMutation.isPending} onPress={() => updateCommentMutation.mutate({ commentId: comment.comment.id, text: editingCommentText.trim() })}><Text style={styles.replyAction}>{updateCommentMutation.isPending ? 'جارٍ الحفظ…' : 'حفظ'}</Text></Pressable>
            </View>
          </View>
        ) : <Text style={styles.commentBody}>{comment.comment.text}</Text>;
        return (
          <View key={item.comment.id} style={styles.commentThread}>
            <View style={styles.commentRow}>
              <View style={styles.commentAvatar}>
                {resolveMediaUrl(item.avatarUrl) ? <Image source={{ uri: resolveMediaUrl(item.avatarUrl) }} style={StyleSheet.absoluteFillObject} contentFit="cover" /> : <Text style={styles.commentAvatarText}>{authorName.slice(0, 1)}</Text>}
              </View>
              <View style={styles.commentContent}>
                <View style={styles.commentHeaderLine}>
                  <Text style={styles.commentAuthor}>{authorName}</Text>
                  <Pressable onPress={() => openCommentMenu(item)} hitSlop={8} accessibilityLabel="خيارات التعليق"><Ionicons name="ellipsis-horizontal" size={16} color={colors.textFaint} /></Pressable>
                </View>
                {renderCommentBody(item)}
                {editingCommentId !== item.comment.id ? <Pressable onPress={() => setReplyTarget({ id: item.comment.id, name: authorName })} accessibilityRole="button"><Text style={styles.replyAction}>رد</Text></Pressable> : null}
              </View>
            </View>
            {replies.map((reply: any) => {
              const replyName = reply.name ?? reply.username ?? 'مستخدم';
              return (
                <View key={reply.comment.id} style={styles.replyRow}>
                  <View style={styles.commentAvatarSmall}>
                    {resolveMediaUrl(reply.avatarUrl) ? <Image source={{ uri: resolveMediaUrl(reply.avatarUrl) }} style={StyleSheet.absoluteFillObject} contentFit="cover" /> : <Text style={styles.commentAvatarText}>{replyName.slice(0, 1)}</Text>}
                  </View>
                  <View style={styles.commentContent}>
                    <View style={styles.commentHeaderLine}>
                      <Text style={styles.commentAuthor}>{replyName}</Text>
                      <Pressable onPress={() => openCommentMenu(reply)} hitSlop={8} accessibilityLabel="خيارات الرد"><Ionicons name="ellipsis-horizontal" size={16} color={colors.textFaint} /></Pressable>
                    </View>
                    {renderCommentBody(reply)}
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
      {commentOpen && (
        <View style={styles.commentComposer}>
          {replyTarget && <View style={styles.replyingTo}><Text style={styles.replyingToText}>الرد على {replyTarget.name}</Text><Pressable onPress={() => setReplyTarget(null)}><Ionicons name="close-circle" size={17} color={colors.textDim} /></Pressable></View>}
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder={replyTarget ? `اكتب ردًا على ${replyTarget.name}…` : "اكتب تعليقًا…"}
            placeholderTextColor={colors.textFaint}
            selectionColor={colors.accent}
            cursorColor={colors.accent}
            style={styles.commentInput}
            returnKeyType="send"
            onSubmitEditing={submitComment}
          />
          <Pressable style={styles.commentSend} onPress={submitComment} accessibilityRole="button" accessibilityLabel={replyTarget ? "إرسال الرد" : "إرسال التعليق"}>
            <Ionicons name="arrow-up" size={16} color={colors.bg} />
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

function OkayHandIcon({ active }: { active: boolean }) {
  const color = active ? colors.accent : colors.textFaint;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" accessibilityLabel="رمز التفاعل">
      <Path d="M2.5 10.5h3.2v10H2.5zM8 20.5h8.2c1 0 1.8-.7 2-1.6l1.4-6.1c.3-1.2-.6-2.3-1.8-2.3h-5.1l.8-4.1c.2-1-.3-2-1.2-2.4L11.5 4 6.8 10.2c-.5.6-.8 1.3-.8 2.1v6.2c0 1.1.9 2 2 2z" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  brand: { color: colors.text, fontSize: fontSizes.xxl, fontWeight: '800', letterSpacing: 0.3 },
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
  heroSection: { marginBottom: spacing.lg },
  heroLoading: { height: 220, marginHorizontal: spacing.lg, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, marginBottom: spacing.lg },
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
  heroTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '800' },
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
  socialSection: { marginBottom: spacing.lg },
  socialCarouselContent: { paddingHorizontal: spacing.lg },
  socialSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  socialTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '800' },
  socialSubtitle: { color: colors.textFaint, fontSize: fontSizes.xs, marginTop: 2 },
  socialMoreButton: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  socialMoreText: { color: colors.accent, fontSize: fontSizes.xs, fontWeight: '800' },
  socialEmpty: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  socialEmptyTitle: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '800', marginTop: spacing.sm },
  socialEmptyText: { color: colors.textDim, fontSize: fontSizes.xs, textAlign: 'center', marginTop: 4 },
  socialCard: { width: SCREEN_W - spacing.lg * 2 - spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginRight: spacing.sm },
  socialCardFullWidth: { width: '100%', marginRight: 0 },
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
  commentThread: { marginTop: spacing.xs },
  commentRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xs, backgroundColor: colors.surfaceHigh, borderRadius: radius.md, padding: spacing.sm },
  replyRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.sm, marginTop: 5, marginRight: 34, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRightWidth: 2, borderRightColor: colors.border },
  commentAvatarSmall: { width: 24, height: 24, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  replyAction: { color: colors.accent, fontSize: 11, fontWeight: '800', marginTop: 5 },
  replyingTo: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginBottom: 4 },
  replyingToText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, overflow: 'hidden', backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { color: colors.bg, fontSize: 12, fontWeight: '800' },
  commentContent: { flex: 1, gap: 3 },
  commentHeaderLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  commentEditInput: { minHeight: 54, color: colors.text, backgroundColor: colors.bg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginTop: spacing.xs, textAlignVertical: 'top' },
  commentInlineActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  commentAuthor: { color: colors.text, fontSize: 11, fontWeight: '800' },
  commentBody: { color: colors.textDim, fontSize: 11, lineHeight: 17 },
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

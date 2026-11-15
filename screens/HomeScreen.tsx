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
import ComicCard from '../components/ComicCard';
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
import { BookSummary } from '../types/books';
import { ComicSummary } from '../types/comics';
import { PlatformAlert as Alert } from '../lib/platform-alert';

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
  const notificationsQuery = trpc.social.notifications.useQuery(undefined, { enabled: Boolean(user) });
  const hardcoverTrendingQuery = trpc.books.trending.useQuery({ limit: 100 }, { retry: 1 });
  const comicTrendingQuery = trpc.comics.trending.useQuery({ limit: 20 }, { retry: 1 });
  const unreadNotifications = (notificationsQuery.data ?? []).filter((item) => item.kind !== 'message' && !item.readAt).length;
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
    void comicTrendingQuery.refetch();
    if (user) void notificationsQuery.refetch();
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


        <SocialReviewFeed
          onOpenDetail={(item) => openCatalogItem(navigation, item)}
          enabled={Boolean(user)}
        />

        <View style={styles.bookSection}>
          <View style={styles.bookSectionHeader}>
            <View><Text style={styles.bookSectionTitle}>الكتب الرائجة عالميًا</Text><Text style={styles.bookSectionSubtitle}>{(hardcoverTrendingQuery.data ?? []).length.toLocaleString('ar')} كتاب</Text></View>
            <Pressable onPress={() => navigation.navigate('Search', { booksTrending: true })} accessibilityRole="button"><Text style={styles.bookSectionMore}>See All</Text></Pressable>
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

        <View style={styles.bookSection}>
          <View style={styles.bookSectionHeader}><View><Text style={styles.bookSectionTitle}>الكوميك الرائجة</Text><Text style={styles.bookSectionSubtitle}>{(comicTrendingQuery.data ?? []).length.toLocaleString('ar')} كوميك</Text></View><Pressable onPress={() => navigation.navigate('Search', { comicsTrending: true })}><Text style={styles.bookSectionMore}>See All</Text></Pressable></View>
          {comicTrendingQuery.isLoading ? <View style={styles.bookLoading}><Text style={styles.bookLoadingText}>جارٍ تحميل الكوميك…</Text></View> : comicTrendingQuery.isError ? <Pressable onPress={() => comicTrendingQuery.refetch()} style={styles.bookError}><Text style={styles.bookErrorText}>تعذر تحميل الكوميك — اضغط لإعادة المحاولة.</Text></Pressable> : <FlatList data={((comicTrendingQuery.data ?? []) as ComicSummary[]).filter((comic) => Boolean(comic.coverUrl))} horizontal showsHorizontalScrollIndicator={false} keyExtractor={(comic) => `comic-${comic.id}`} contentContainerStyle={styles.bookList} ListEmptyComponent={<View style={styles.bookLoading}><Text style={styles.bookLoadingText}>لا توجد كوميك بأغلفة متاحة حاليًا.</Text></View>} renderItem={({ item }) => <ComicCard comic={item} width={112} onPress={() => navigation.navigate('ComicDetail', { id: item.id, comic: item })} />} />}
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

type FeedComment = {
  comment: { id: number; reviewId: number; userId: number; parentCommentId: number | null; text: string; createdAt: string | Date; updatedAt: string | Date };
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
};

function SocialReviewFeed({ onOpenDetail, enabled }: { onOpenDetail: (review: { mediaType: ReviewMediaType; mediaId: number; title: string; posterPath: string | null }) => void; enabled: boolean }) {
  const [showAllReviews, setShowAllReviews] = useState(false);
  const feedQuery = trpc.social.feed.useQuery(undefined, { enabled });
  const rows = (feedQuery.data ?? []) as FeedRow[];
  const visibleRows = showAllReviews ? rows : rows.slice(0, 3);
  if (!enabled) return null;

  return (
    <View style={styles.socialSection}>
      <View style={styles.socialSectionHeader}>
        <View>
          <Text style={styles.socialTitle}>مراجعات المجتمع</Text>
          <Text style={styles.socialSubtitle}>آخر ما نشره الأشخاص الذين تتابعهم</Text>
        </View>
        {rows.length > 3 ? (
          <Pressable style={styles.socialMoreButton} onPress={() => setShowAllReviews((current) => !current)} accessibilityRole="button">
            <Text style={styles.socialMoreText}>{showAllReviews ? 'عرض أقل' : 'عرض الكل'}</Text>
            <Ionicons name={showAllReviews ? 'chevron-up' : 'chevron-down'} size={15} color={colors.accent} />
          </Pressable>
        ) : <Ionicons name="chatbubbles-outline" size={19} color={colors.textDim} />}
      </View>
      {feedQuery.isLoading ? (
        <View style={styles.socialEmpty}><Text style={styles.socialEmptyText}>جارٍ تحميل المراجعات…</Text></View>
      ) : feedQuery.isError ? (
        <ApiErrorState message="تعذر تحميل مراجعات المجتمع." onRetry={() => feedQuery.refetch()} />
      ) : rows.length === 0 ? (
        <View style={styles.socialEmpty}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.textFaint} />
          <Text style={styles.socialEmptyTitle}>لا توجد مراجعات جديدة بعد</Text>
          <Text style={styles.socialEmptyText}>عندما ينشر الأشخاص الذين تتابعهم مراجعاتهم، ستظهر هنا.</Text>
        </View>
      ) : (
        visibleRows.map((row, index) => (
          <FeedReviewCard key={row.review.id} row={row} index={index} onOpenDetail={onOpenDetail} onChanged={() => feedQuery.refetch()} />
        ))
      )}
    </View>
  );
}

function FeedReviewCard({ row, index, onOpenDetail, onChanged }: {
  row: FeedRow;
  index: number;
  onOpenDetail: (review: { mediaType: ReviewMediaType; mediaId: number; title: string; posterPath: string | null }) => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const { review, username, displayName, avatarUrl, likeCount, commentCount, likedByMe } = row;
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [showAllComments, setShowAllComments] = useState(false);
  const commentsQuery = trpc.social.comments.useQuery({ reviewId: review.id }, { enabled: commentOpen });
  const toggleLikeMutation = trpc.social.toggleLike.useMutation({ onSuccess: onChanged });
  const addCommentMutation = trpc.social.addComment.useMutation({ onSuccess: () => { setCommentText(''); setReplyTo(null); void commentsQuery.refetch(); onChanged(); } });
  const updateCommentMutation = trpc.social.updateComment.useMutation({ onSuccess: () => { setEditingCommentId(null); setEditingCommentText(''); void commentsQuery.refetch(); } });
  const deleteCommentMutation = trpc.social.deleteComment.useMutation({ onSuccess: () => { void commentsQuery.refetch(); onChanged(); } });
  const reportMutation = trpc.social.report.useMutation({ onSuccess: () => Alert.alert('تم إرسال البلاغ', 'شكرًا، سيراجع فريق Blinkr البلاغ.') });

  const submitComment = () => {
    if (!commentText.trim() || addCommentMutation.isPending) return;
    addCommentMutation.mutate({ reviewId: review.id, text: commentText.trim(), parentCommentId: replyTo?.id });
  };
  const poster = catalogPosterUrl(review.mediaType, review.posterPath, 'w342');
  const createdAtMs = new Date(review.createdAt).getTime();
  const comments = (commentsQuery.data ?? []) as FeedComment[];
  const rootComments = comments.filter((item) => !item.comment.parentCommentId);
  const visibleComments = showAllComments ? rootComments : rootComments.slice(0, 3);
  const authorName = displayName ?? username ?? 'مستخدم';

  const openReviewMenu = () => Alert.alert('خيارات المراجعة', 'اختر إجراءً', [
    { text: 'إبلاغ عن المراجعة', onPress: () => reportMutation.mutate({ targetType: 'review', targetId: review.id, reason: 'other' }) },
    { text: 'إلغاء', style: 'cancel' },
  ]);

  const openCommentMenu = (item: FeedComment) => {
    const ownComment = item.comment.userId === user?.id;
    const actions: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [];
    if (ownComment) {
      actions.push(
        { text: 'تعديل التعليق', onPress: () => { setEditingCommentId(item.comment.id); setEditingCommentText(item.comment.text); } },
        { text: 'حذف التعليق', style: 'destructive', onPress: () => Alert.alert('حذف التعليق', 'هل تريد حذف هذا التعليق؟ ستُحذف ردوده أيضًا.', [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'حذف', style: 'destructive', onPress: () => deleteCommentMutation.mutate({ commentId: item.comment.id }) },
        ]) },
      );
    } else {
      actions.push({ text: 'إبلاغ', onPress: () => reportMutation.mutate({ targetType: 'comment', targetId: item.comment.id, reason: 'other' }) });
    }
    actions.push({ text: 'إلغاء', style: 'cancel' });
    Alert.alert('خيارات التعليق', 'اختر إجراءً', actions);
  };

  const renderComment = (item: FeedComment, isReply = false) => {
    const name = item.name ?? item.username ?? 'مستخدم';
    const ownComment = item.comment.userId === user?.id;
    return (
      <View key={item.comment.id} style={[styles.commentRow, isReply && styles.commentReplyRow]}>
        <View style={styles.commentAvatar}>
          {resolveMediaUrl(item.avatarUrl) ? <Image source={{ uri: resolveMediaUrl(item.avatarUrl) }} style={StyleSheet.absoluteFillObject} contentFit="cover" /> : <Text style={styles.commentAvatarText}>{name.slice(0, 1)}</Text>}
        </View>
        <View style={styles.commentContent}>
          <View style={styles.commentTopLine}>
            <Text style={styles.commentAuthor} numberOfLines={1}>{name}</Text>
            <Pressable onPress={() => openCommentMenu(item)} hitSlop={8} accessibilityLabel="خيارات التعليق">
              <Ionicons name="ellipsis-horizontal" size={16} color={colors.textFaint} />
            </Pressable>
          </View>
          {editingCommentId === item.comment.id ? (
            <View>
              <TextInput value={editingCommentText} onChangeText={setEditingCommentText} style={styles.commentEditInput} multiline maxLength={1000} textAlign="right" />
              <View style={styles.commentInlineActions}>
                <Pressable onPress={() => { setEditingCommentId(null); setEditingCommentText(''); }}><Text style={styles.commentCancelText}>إلغاء</Text></Pressable>
                <Pressable disabled={!editingCommentText.trim() || updateCommentMutation.isPending} onPress={() => updateCommentMutation.mutate({ commentId: item.comment.id, text: editingCommentText.trim() })}><Text style={styles.commentReplyAction}>{updateCommentMutation.isPending ? 'جارٍ الحفظ…' : 'حفظ'}</Text></Pressable>
              </View>
            </View>
          ) : <Text style={styles.commentBody}>{item.comment.text}</Text>}
          {!isReply && editingCommentId !== item.comment.id ? (
            <Pressable onPress={() => { setReplyTo({ id: item.comment.id, name }); setCommentOpen(true); }} style={styles.commentReplyButton}>
              <Text style={styles.commentReplyAction}>رد</Text>
            </Pressable>
          ) : null}
          {ownComment && new Date(item.comment.updatedAt).getTime() > new Date(item.comment.createdAt).getTime() + 1000 ? <Text style={styles.commentEdited}>تم التعديل</Text> : null}
        </View>
      </View>
    );
  };

  return (
    <Animated.View style={styles.socialCard} entering={index >= 3 ? FadeInDown.duration(240).withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] }) : undefined} exiting={index >= 3 ? FadeOutUp.duration(180) : undefined}>
      <View style={styles.socialCardHeader}>
        <View style={[styles.socialAvatar, { backgroundColor: colors.surfaceHigh }]}>
          {resolveMediaUrl(avatarUrl) ? <Image source={{ uri: resolveMediaUrl(avatarUrl) }} style={StyleSheet.absoluteFillObject} contentFit="cover" /> : <Text style={styles.socialAvatarText}>{authorName.slice(0, 1)}</Text>}
        </View>
        <View style={styles.socialAuthorBlock}>
          <Text style={styles.socialAuthor}>{authorName}</Text>
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
        <Pressable style={styles.socialAction} onPress={() => toggleLikeMutation.mutate({ reviewId: review.id })} disabled={toggleLikeMutation.isPending} accessibilityRole="button" accessibilityLabel={likedByMe ? 'إلغاء الإعجاب بالمراجعة' : 'الإعجاب بالمراجعة'}>
          <Ionicons name={likedByMe ? 'thumbs-up' : 'thumbs-up-outline'} size={19} color={likedByMe ? colors.accent : colors.textDim} />
          <Text style={[styles.socialActionText, likedByMe && { color: colors.accent }]}>{likeCount}</Text>
        </Pressable>
        <Pressable style={styles.socialAction} onPress={() => setCommentOpen((current) => !current)} accessibilityRole="button" accessibilityLabel="التعليق على المراجعة">
          <Ionicons name="chatbubble-outline" size={19} color={colors.textDim} />
          <Text style={styles.socialActionText}>{commentCount}</Text>
        </Pressable>
      </View>
      {commentOpen ? (
        <View style={styles.commentsPanel}>
          {commentsQuery.isLoading ? <Text style={styles.commentsHint}>جارٍ تحميل التعليقات…</Text> : null}
          {visibleComments.map((item) => (
            <View key={item.comment.id}>
              {renderComment(item)}
              {comments.filter((reply) => reply.comment.parentCommentId === item.comment.id).map((reply) => renderComment(reply, true))}
            </View>
          ))}
          {rootComments.length > 3 ? (
            <Pressable onPress={() => setShowAllComments((value) => !value)} style={styles.showCommentsButton}>
              <Text style={styles.commentReplyAction}>{showAllComments ? 'عرض تعليقات أقل' : 'عرض كل التعليقات (' + rootComments.length + ')'}</Text>
            </Pressable>
          ) : null}
          {replyTo ? (
            <View style={styles.replyingBanner}>
              <Text style={styles.replyingText}>الرد على {replyTo.name}</Text>
              <Pressable onPress={() => setReplyTo(null)}><Ionicons name="close" size={16} color={colors.textDim} /></Pressable>
            </View>
          ) : null}
          <View style={styles.commentComposer}>
            <TextInput value={commentText} onChangeText={setCommentText} placeholder={replyTo ? 'اكتب ردًا على ' + replyTo.name + '…' : 'اكتب تعليقًا…'} placeholderTextColor={colors.textFaint} selectionColor={colors.accent} cursorColor={colors.accent} style={styles.commentInput} returnKeyType="send" onSubmitEditing={submitComment} maxLength={1000} />
            <Pressable style={[styles.commentSend, (!commentText.trim() || addCommentMutation.isPending) && styles.commentSendDisabled]} onPress={submitComment} disabled={!commentText.trim() || addCommentMutation.isPending} accessibilityRole="button" accessibilityLabel={replyTo ? 'إرسال الرد' : 'إرسال التعليق'}>
              <Ionicons name="arrow-up" size={16} color={colors.bg} />
            </Pressable>
          </View>
        </View>
      ) : null}
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
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm, paddingVertical: spacing.xs },
  commentReplyRow: { marginLeft: 28, paddingLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.border },
  commentAvatar: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { color: colors.textDim, fontSize: 11, fontWeight: '800' },
  commentContent: { flex: 1, minWidth: 0, backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  commentTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  commentAuthor: { color: colors.text, fontSize: 11, fontWeight: '800', flex: 1, textAlign: 'right' },
  commentBody: { color: colors.textDim, fontSize: 12, lineHeight: 18, marginTop: 3, textAlign: 'right' },
  commentReplyButton: { alignSelf: 'flex-end', marginTop: 4, paddingVertical: 2 },
  commentReplyAction: { color: colors.accent, fontSize: 11, fontWeight: '800' },
  commentEdited: { color: colors.textFaint, fontSize: 9, marginTop: 2, textAlign: 'right' },
  commentEditInput: { minHeight: 54, color: colors.text, backgroundColor: colors.bg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginTop: spacing.xs, textAlignVertical: 'top' },
  commentInlineActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  commentCancelText: { color: colors.textFaint, fontSize: 11 },
  commentsPanel: { marginTop: spacing.xs, paddingTop: spacing.xs },
  commentsHint: { color: colors.textFaint, fontSize: 11, textAlign: 'center', padding: spacing.sm },
  showCommentsButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  replyingBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 6, backgroundColor: colors.surfaceHigh, borderRadius: radius.sm },
  replyingText: { color: colors.textDim, fontSize: 11 },
  commentSendDisabled: { opacity: 0.45 },
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

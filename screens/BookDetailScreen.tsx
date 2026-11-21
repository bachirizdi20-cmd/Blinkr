import React, { useEffect, useMemo, useState } from 'react';
import AppRefreshControl from '../components/AppRefreshControl';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ContentStackParamList } from '../navigation/types';
import { BookSummary } from '../types/books';
import { trpc } from '../lib/trpc';
import { isBookDetailCompatible, mergeBookDetails } from '../lib/book-utils';
import { useAuth } from '../hooks/use-auth';
import { useLibrary } from '../context/LibraryContext';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import ApiErrorState from '../components/ApiErrorState';
import { PlatformAlert as Alert } from '../lib/platform-alert';
import BookCard from '../components/BookCard';
import DetailActionBar from '../components/DetailActionBar';
import FiveStarRating from '../components/FiveStarRating';
import ContentDetailHero from '../components/ContentDetailHero';
import LoadingView from '../components/LoadingView';
import { readPersistentCache, writePersistentCache } from '../lib/persistent-cache';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type RouteT = RouteProp<ContentStackParamList, 'BookDetail'>;

export default function BookDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const workId = Number(route.params.workId);
  const { book: fallback } = route.params;
  const { user } = useAuth();
  const lib = useLibrary();
  const [cachedBook, setCachedBook] = useState<Partial<BookSummary> | undefined>(fallback);
  const mediaSource = 'hardcover' as const;
  const validWorkId = Number.isInteger(workId) && workId > 0;
  const detailQuery = trpc.books.detail.useQuery({ workId }, { enabled: validWorkId, retry: 1 });
  useEffect(() => {
    void readPersistentCache<Partial<BookSummary>>(`book-detail:${workId}`).then((value) => { if (value) setCachedBook((current) => current ?? value); });
  }, [workId]);
  useEffect(() => {
    if (detailQuery.data) void writePersistentCache(`book-detail:${workId}`, detailQuery.data);
  }, [workId, detailQuery.data]);
  const statusQuery = trpc.library.getStatus.useQuery({ mediaType: 'book', mediaId: workId, mediaSource }, { enabled: Boolean(user), retry: false });
  const myReviewQuery = trpc.reviews.getMine.useQuery({ mediaType: 'book', mediaId: workId, mediaSource }, { enabled: Boolean(user), retry: false });
  const setStatusMutation = trpc.library.setStatus.useMutation();
  const removeStatusMutation = trpc.library.removeStatus.useMutation();
  const saveReviewMutation = trpc.reviews.save.useMutation();

  const fallbackBook = fallback ?? cachedBook;
  const detailCompatible = isBookDetailCompatible(fallbackBook, detailQuery.data);
  const book = useMemo(() => mergeBookDetails(workId, fallbackBook, detailCompatible ? detailQuery.data : null), [workId, fallbackBook, detailQuery.data, detailCompatible]);
  const similarQuery = trpc.books.similar.useQuery(
    { workId, subjects: book.subjects.slice(0, 5), authorName: book.authorNames[0], limit: 20 },
    { enabled: validWorkId && Boolean(book.coverUrl), retry: 1 },
  );

  const localRead = lib.isWatched('book', workId);
  const isRead = localRead || statusQuery.data?.status === 'watched';
  const isReading = statusQuery.data?.status === 'watching';
  const inWatchlist = lib.isInWatchlist('book', workId) || statusQuery.data?.status === 'watchlist';
  const rating = lib.getLatestRating('book', workId) ?? myReviewQuery.data?.rating ?? 0;
  const mediaRef = { mediaType: 'book' as const, mediaId: workId, title: book.title, posterPath: book.coverUrl, date: book.firstPublishYear ? String(book.firstPublishYear) : undefined };
  const statusBusy = setStatusMutation.isPending || removeStatusMutation.isPending || (Boolean(user) && statusQuery.isLoading);

  const requireSignIn = () => {
    Alert.alert('يلزم تسجيل الدخول', 'سجّل الدخول لحفظ حالة القراءة ومزامنتها مع حسابك.', [{ text: 'حسنًا' }]);
  };

  const syncStatus = async (status: 'watched' | 'watching' | 'watchlist' | null) => {
    if (!user) {
      requireSignIn();
      return;
    }
    try {
      if (status) await setStatusMutation.mutateAsync({ ...mediaRef, mediaSource, status });
      else await removeStatusMutation.mutateAsync({ mediaType: 'book', mediaId: workId, mediaSource });
      await statusQuery.refetch();
    } catch (error) {
      Alert.alert('تعذرت مزامنة الحالة', error instanceof Error ? error.message : 'احتفظنا بالتغيير المحلي. حاول مرة أخرى.');
    }
  };

  const handleReadToggle = async () => {
    if (!user) { requireSignIn(); return; }
    if (isRead) {
      if (localRead) lib.toggleWatchedQuick(mediaRef);
      if (statusQuery.data?.status === 'watched') await syncStatus(null);
      return;
    }
    lib.toggleWatchedQuick(mediaRef);
    await syncStatus('watched');
  };

  const handleWatchlistToggle = async () => {
    if (!user) { requireSignIn(); return; }
    if (inWatchlist) {
      if (lib.isInWatchlist('book', workId)) lib.toggleWatchlist(mediaRef);
      if (statusQuery.data?.status === 'watchlist') await syncStatus(null);
      return;
    }
    lib.toggleWatchlist(mediaRef);
    await syncStatus('watchlist');
  };

  const handleReadingToggle = async () => {
    if (!user) { requireSignIn(); return; }
    await syncStatus(isReading ? null : 'watching');
  };

  const openReview = () => navigation.navigate('ReviewModal', {
    mediaType: 'book',
    mediaId: workId,
    mediaSource,
    title: book.title,
    posterPath: book.coverUrl,
  });

  if (!validWorkId) return <SafeAreaView style={styles.safe}><ApiErrorState message="معرّف الكتاب غير صالح. أعد فتحه من القائمة." onRetry={() => navigation.goBack()} /></SafeAreaView>;
  if (detailQuery.isLoading && !fallbackBook) return <LoadingView />;

  if (detailQuery.isError && !fallbackBook) {
    return <SafeAreaView style={styles.safe}><View style={styles.topBar}><Pressable onPress={() => navigation.goBack()} style={styles.iconButton}><Ionicons name="chevron-back" size={22} color={colors.text} /></Pressable></View><ApiErrorState message="تعذر تحميل تفاصيل الكتاب من Hardcover." onRetry={() => void detailQuery.refetch()} /></SafeAreaView>;
  }

  const info = [
    book.firstPublishYear ? `سنة النشر ${book.firstPublishYear}` : book.firstPublishDate,
    book.pageCount ? `${book.pageCount} صفحة` : null,
    book.isbn ? `ISBN ${book.isbn}` : null,
  ].filter(Boolean);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton} accessibilityLabel="رجوع"><Ionicons name="chevron-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.topTitle}>تفاصيل الكتاب</Text>
        <Pressable onPress={() => navigation.navigate('People', { shareMedia: { mediaType: 'book', mediaId: workId, mediaSource, title: book.title, posterPath: book.coverUrl, rating, overview: book.description } })} style={styles.iconButton} accessibilityLabel="مشاركة الكتاب"><Ionicons name="share-social-outline" size={19} color={colors.text} /></Pressable>
      </View>
      <ScrollView refreshControl={<AppRefreshControl />} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ContentDetailHero
          title={book.title}
          imageUri={book.coverUrl}
          fallbackIcon="book-outline"
          metadata={info}
          scoreText={book.ratingsAverage != null && book.ratingsCount > 0 ? `${book.ratingsAverage.toFixed(1)} / 5` : null}
          scoreLabel={book.ratingsCount > 0 ? `Hardcover · ${book.ratingsCount.toLocaleString('ar')} تقييم` : undefined}
        >
          {book.authorNames.length > 0 ? <View style={styles.authorRow}>{book.authorNames.map((author) => <Pressable key={author} onPress={() => navigation.navigate('AuthorBooks', { authorName: author, excludeWorkId: workId })} accessibilityRole="button" accessibilityLabel={`عرض كتب ${author}`}><Text style={styles.authors}>{author}</Text></Pressable>)}</View> : <Text style={styles.muted}>المؤلف غير محدد</Text>}
        </ContentDetailHero>

        <DetailActionBar
          completed={isRead}
          inList={inWatchlist}
          completionLabel="تمت قراءته"
          listLabel="قائمة القراءة"
          onReview={openReview}
          onToggleList={() => void handleWatchlistToggle()}
          onToggleCompleted={() => void handleReadToggle()}
          inProgress={isReading}
          inProgressLabel="أقرأ الآن"
          startProgressLabel="بدء القراءة"
          onToggleInProgress={() => void handleReadingToggle()}
          rating={rating}
          onRatingChange={(value) => { lib.setQuickRating(mediaRef, value); if (user) void saveReviewMutation.mutateAsync({ mediaType: 'book', mediaId: workId, mediaSource, title: book.title, posterPath: book.coverUrl, rating: value, review: myReviewQuery.data?.review ?? '', spoiler: false, watchedDate: myReviewQuery.data?.watchedDate ? new Date(myReviewQuery.data.watchedDate).toISOString() : new Date().toISOString() }).then(() => myReviewQuery.refetch()).catch((error) => Alert.alert('تعذر حفظ التقييم', error instanceof Error ? error.message : 'حاول مرة أخرى.')); }}
        />

        {myReviewQuery.data ? <Pressable style={styles.ownReviewCard} onPress={openReview} accessibilityRole="button"><View style={styles.ownReviewHeader}><Text style={styles.sectionTitle}>مراجعتك</Text><FiveStarRating rating={myReviewQuery.data.rating} size={15} /></View>{!!myReviewQuery.data.review ? <Text style={styles.ownReviewText}>{myReviewQuery.data.review}</Text> : <Text style={styles.muted}>اضغط لتعديل تقييمك.</Text>}</Pressable> : null}

        <View style={styles.section}><Text style={styles.sectionTitle}>نبذة</Text><Text style={styles.description}>{book.description || 'لا يتوفر وصف لهذا الكتاب بعد.'}</Text></View>
        {book.subjects.length ? <View style={styles.section}><Text style={styles.sectionTitle}>التصنيفات</Text><View style={styles.subjects}>{book.subjects.slice(0, 8).map((subject) => <View key={subject} style={styles.subject}><Text style={styles.subjectText}>{subject}</Text></View>)}</View></View> : null}
        <View style={styles.similarSection}>
          <Text style={styles.sectionTitle}>كتب مشابهة</Text>
          {similarQuery.isLoading ? <Text style={styles.muted}>جارٍ تحميل الكتب المشابهة…</Text> : similarQuery.isError ? <Pressable onPress={() => void similarQuery.refetch()}><Text style={styles.muted}>تعذر تحميل الكتب المشابهة — اضغط لإعادة المحاولة.</Text></Pressable> : similarQuery.data?.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarList}>{similarQuery.data.filter((item) => Boolean(item.coverUrl)).map((item) => <BookCard key={item.workId} book={item} width={112} onPress={() => navigation.push('BookDetail', { workId: item.workId, book: item })} />)}</ScrollView> : <Text style={styles.muted}>لا توجد كتب مشابهة بأغلفة متاحة حاليًا.</Text>}
        </View>
        {book.sourceUrl ? <Pressable onPress={() => Linking.openURL(book.sourceUrl!)} style={styles.sourceLink}><Text style={styles.sourceText}>عرض المصدر على Hardcover</Text><Ionicons name="open-outline" size={15} color={colors.accent} /></Pressable> : null}
        {!detailCompatible ? <Text style={styles.muted}>تعذر التحقق من مصدر الكتاب المحفوظ؛ نعرض بياناته المحفوظة فقط.</Text> : null}
        {detailQuery.isError ? <Pressable onPress={() => void detailQuery.refetch()} accessibilityRole="button"><Text style={styles.muted}>تعذر جلب التفاصيل؛ نعرض البيانات المتاحة. اضغط لإعادة المحاولة.</Text></Pressable> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  topTitle: { flex: 1, textAlign: 'center', color: colors.text, fontSize: fontSizes.md, fontWeight: '800' },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  hero: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.md },
  coverFrame: { width: 132, height: 194, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
  cover: { width: '100%', height: '100%' },
  coverFallback: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.sm },
  heroCopy: { flex: 1, gap: spacing.sm, alignItems: 'flex-end' },
  authorRow: { gap: 3 },
  title: { color: colors.text, fontSize: fontSizes.xl, lineHeight: 28, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  authors: { color: colors.accent, fontSize: fontSizes.md, lineHeight: 21, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  meta: { color: colors.textDim, fontSize: fontSizes.sm, textAlign: 'right', writingDirection: 'rtl' },
  ratingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginTop: 2 },
  rating: { color: colors.gold, fontSize: fontSizes.sm, fontWeight: '800' },
  yourRating: { color: colors.accent, fontSize: fontSizes.sm, fontWeight: '800', marginTop: 2 },
  muted: { color: colors.textFaint, fontSize: fontSizes.xs, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.lg },
  action: { flex: 1, minHeight: 75, alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 4, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionSelected: { borderColor: colors.accent, backgroundColor: 'rgba(31, 215, 171, 0.08)' },
  actionDisabled: { opacity: 0.55 },
  actionText: { color: colors.textDim, fontSize: 10, lineHeight: 14, textAlign: 'center', fontWeight: '700' },
  actionTextSelected: { color: colors.accent },
  reviewButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.accent, minHeight: 48, borderRadius: radius.md, marginTop: spacing.md },
  reviewButtonText: { color: colors.bg, fontSize: fontSizes.md, fontWeight: '900' },
  addList: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, marginTop: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  addListText: { flex: 1, color: colors.text, fontSize: fontSizes.sm, fontWeight: '700' },
  section: { marginTop: spacing.xl },
  ownReviewCard: { marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  ownReviewHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  ownReviewText: { color: colors.textDim, fontSize: fontSizes.sm, lineHeight: 22, marginTop: spacing.sm, textAlign: 'right' },
  similarSection: { marginTop: spacing.xl },
  similarList: { paddingLeft: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '900', marginBottom: spacing.sm },
  description: { color: colors.textDim, fontSize: fontSizes.md, lineHeight: 24 },
  subjects: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  subject: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill },
  subjectText: { color: colors.textDim, fontSize: fontSizes.xs },
  sourceLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.xl },
  sourceText: { color: colors.accent, fontSize: fontSizes.sm, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
});

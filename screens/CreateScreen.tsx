import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import BookCard from '../components/BookCard';
import EmptyState from '../components/EmptyState';
import GeneralErrorState from '../components/GeneralErrorState';
import { trpc } from '../lib/trpc';
import { isAnimeItem } from '../lib/media-categories';
import { BookSummary } from '../types/books';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import { useAuth } from '../hooks/use-auth';
import { useLibrary } from '../context/LibraryContext';

type Category = 'all' | 'movie' | 'tv' | 'anime' | 'book';
type TmdbItem = { id: number; media_type?: 'movie' | 'tv'; title?: string; name?: string; poster_path?: string | null; posterPath?: string | null; overview?: string; vote_average?: number; voteAverage?: number; first_air_date?: string; release_date?: string; genre_ids?: number[]; original_language?: string };
const CATEGORIES: { key: Category; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'all', label: 'الكل', icon: 'sparkles-outline' },
  { key: 'movie', label: 'أفلام', icon: 'film-outline' },
  { key: 'tv', label: 'مسلسلات', icon: 'tv-outline' },
  { key: 'anime', label: 'أنمي', icon: 'color-wand-outline' },
  { key: 'book', label: 'كتب', icon: 'book-outline' },
];

export default function CreateScreen() {
  const { user } = useAuth();
  const lib = useLibrary();
  const [category, setCategory] = useState<Category>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<TmdbItem[]>([]);
  const [bookPage, setBookPage] = useState(1);
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [selectedItem, setSelectedItem] = useState<TmdbItem | BookSummary | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [saving, setSaving] = useState(false);
  const trimmed = query.trim();
  const [debouncedQuery, setDebouncedQuery] = useState(trimmed);
  const bookMode = category === 'book';
  const searching = debouncedQuery.length >= 2;
  const bookSearchReady = searching && trimmed === debouncedQuery;
  const path = searching ? '/search/multi' : '/trending/all/week';

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(trimmed), 350);
    return () => clearTimeout(timer);
  }, [trimmed]);

  const tmdbQuery = trpc.tmdb.get.useQuery(
    { path, params: { page, include_adult: false, ...(searching ? { query: debouncedQuery } : {}) } },
    { retry: 1, enabled: !bookMode },
  );
  const bookQuery = trpc.books.search.useQuery(
    { query: debouncedQuery, page: bookPage, limit: 20 },
    { retry: 1, enabled: bookMode && bookSearchReady },
  );

  useEffect(() => { setPage(1); setItems([]); setBookPage(1); setBooks([]); }, [trimmed]);
  useEffect(() => {
    const next = ((tmdbQuery.data as any)?.results ?? []).filter((item: TmdbItem) => item.media_type === 'movie' || item.media_type === 'tv' || (!item.media_type && (item.title || item.release_date)));
    setItems((current) => page === 1 ? next : [...current, ...next.filter((item: TmdbItem) => !current.some((existing) => existing.id === item.id && (existing.media_type ?? '') === (item.media_type ?? '')))]);
  }, [tmdbQuery.data, page]);
  useEffect(() => {
    if (!bookSearchReady || !bookQuery.data || bookQuery.data.page !== bookPage) return;
    const next = bookQuery.data.results;
    setBooks((current) => bookPage === 1 ? next : [...current, ...next.filter((book) => !current.some((existing) => existing.workId === book.workId))]);
  }, [bookQuery.data, bookPage, bookSearchReady]);

  const results = useMemo(() => items.filter((item) => {
    const type = item.media_type ?? (item.title ? 'movie' : 'tv');
    if (category === 'all') return true;
    if (category === 'anime') return isAnimeItem(item.genre_ids, item.original_language);
    return type === category;
  }), [items, category]);

  const openReview = (item: TmdbItem) => {
    setSelectedItem(item);
    setSearchOpen(false);
  };
  const saveReviewMutation = trpc.reviews.save.useMutation();
  const selection = selectedItem ? ('workId' in selectedItem ? { mediaType: 'book' as const, mediaId: selectedItem.workId, title: selectedItem.title, posterPath: selectedItem.coverUrl, genreIds: [] as number[], mediaSource: 'hardcover' as const } : { mediaType: (selectedItem.media_type ?? (selectedItem.title ? 'movie' : 'tv')) as 'movie' | 'tv', mediaId: selectedItem.id, title: selectedItem.title ?? selectedItem.name ?? 'عنوان بلا اسم', posterPath: selectedItem.posterPath ?? selectedItem.poster_path ?? null, genreIds: selectedItem.genre_ids ?? [], mediaSource: undefined }) : null;
  const publishReview = async () => {
    if (!selection) return;
    if (!user) { Alert.alert('يلزم تسجيل الدخول', 'سجّل الدخول لنشر مراجعتك.'); return; }
    const trimmedReview = review.trim();
    if (rating === 0 && !trimmedReview) { Alert.alert('أضف تقييمًا أو مراجعة', 'اختر تقييمًا أو اكتب رأيك قبل النشر.'); return; }
    setSaving(true);
    try {
      await saveReviewMutation.mutateAsync({ mediaType: selection.mediaType, mediaId: selection.mediaId, ...(selection.mediaSource ? { mediaSource: selection.mediaSource } : {}), title: selection.title, posterPath: selection.posterPath, rating, review: trimmedReview, spoiler: false, watchedDate: new Date().toISOString() });
      lib.addDiaryEntry({ mediaType: selection.mediaType, mediaId: selection.mediaId, title: selection.title, posterPath: selection.posterPath, genreIds: selection.genreIds, watchedDate: new Date().toISOString().slice(0, 10), rating, review: trimmedReview, rewatch: false, spoiler: false });
      Alert.alert('تم نشر المراجعة', 'ظهرت مراجعتك بنجاح.');
      setSelectedItem(null); setSearchOpen(false); setQuery(''); setRating(0); setReview('');
    } catch (error) { Alert.alert('تعذر نشر المراجعة', error instanceof Error ? error.message : 'تحقق من الاتصال ثم حاول مرة أخرى.'); } finally { setSaving(false); }
  };
  const handleQueryChange = (value: string) => { setQuery(value); setPage(1); setItems([]); setBookPage(1); setBooks([]); };
  const tmdbHasMore = Number((tmdbQuery.data as any)?.total_pages ?? 1) > page;
  const booksHasMore = Number(bookQuery.data?.totalPages ?? 1) > bookPage;
  const loadMore = () => {
    if (bookMode) {
      if (!bookQuery.isFetching && booksHasMore) setBookPage((value) => value + 1);
    } else if (!tmdbQuery.isFetching && tmdbHasMore) {
      setPage((value) => value + 1);
    }
  };
  const loading = bookMode ? bookQuery.isLoading : tmdbQuery.isLoading;
  const failed = bookMode ? bookQuery.isError : tmdbQuery.isError;
  const refetch = () => { if (bookMode) void bookQuery.refetch(); else void tmdbQuery.refetch(); };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View><Text style={styles.eyebrow}>إنشاء مراجعة</Text><Text style={styles.title}>شارك رأيك</Text></View>
        <View style={styles.headerButton}><Ionicons name="create-outline" size={20} color={colors.accent} /></View>
      </View>
      {!selectedItem && !searchOpen ? <Pressable style={styles.addCard} onPress={() => setSearchOpen(true)} accessibilityRole="button" accessibilityLabel="اختيار عنوان للمراجعة"><View style={styles.addIcon}><Ionicons name="add" size={34} color={colors.accent} /></View><Text style={styles.addTitle}>اختر فيلمًا أو مسلسلًا أو كتابًا</Text><Text style={styles.addHint}>اضغط لإضافة عنوان وبدء مراجعتك</Text></Pressable> : null}
      {selectedItem && !searchOpen ? <View style={styles.editor}><Pressable style={styles.selectedCard} onPress={() => setSearchOpen(true)}><Image source={{ uri: selection?.posterPath ? (selection.mediaType === 'book' ? selection.posterPath : `https://image.tmdb.org/t/p/w342${selection.posterPath}`) : undefined }} style={styles.selectedPoster} resizeMode="cover" /><View style={styles.selectedCopy}><Text style={styles.selectedLabel}>العنوان المختار</Text><Text style={styles.selectedTitle} numberOfLines={2}>{selection?.title}</Text><Text style={styles.changeText}>اضغط لتغيير العنوان</Text></View></Pressable><View style={styles.editorSection}><Text style={styles.editorLabel}>تقييمك من 10</Text><View style={styles.ratingStars}>{Array.from({ length: 10 }, (_, index) => { const value = index + 1; return <Pressable key={value} onPress={() => setRating(value)} hitSlop={3} accessibilityLabel={`تقييم ${value} من 10`}><Ionicons name={rating >= value ? 'star' : 'star-outline'} size={25} color={rating >= value ? colors.accent : colors.textFaint} /></Pressable>; })}</View><Text style={styles.ratingValue}>{rating > 0 ? `${rating}/10` : 'اختر تقييمك'}</Text></View><View style={styles.editorSection}><View style={styles.reviewHeader}><Text style={styles.editorLabel}>مراجعتك</Text><Text style={styles.counter}>{review.length}/1000</Text></View><TextInput style={styles.reviewInput} value={review} onChangeText={(value) => setReview(value.slice(0, 1000))} placeholder="اكتب مراجعتك..." placeholderTextColor={colors.textFaint} multiline textAlignVertical="top" /><Text style={styles.reviewHint}>شارك أفكارك وانطباعاتك حول هذا العمل...</Text></View><Pressable onPress={publishReview} disabled={saving} style={({ pressed }) => [styles.publishButton, pressed && styles.pressed, saving && styles.disabled]}>{saving ? <ActivityIndicator color={colors.bg} /> : <Ionicons name="send" size={18} color={colors.bg} />}<Text style={styles.publishText}>{saving ? 'جارٍ النشر…' : 'نشر المراجعة'}</Text></Pressable></View> : null}
      {searchOpen ? <>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput style={styles.searchInput} placeholder={bookMode ? 'ابحث عن كتاب أو مؤلف…' : 'ابحث عن فيلم أو مسلسل أو أنمي…'} placeholderTextColor={colors.textFaint} value={query} onChangeText={handleQueryChange} autoCorrect={false} returnKeyType="search" />
        {query.length > 0 ? <Pressable onPress={() => handleQueryChange('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.textFaint} /></Pressable> : null}
      </View>
      {bookMode && !bookSearchReady ? (
        <EmptyState icon="book-outline" title="ابحث عن كتاب" message="اكتب اسم كتاب أو مؤلف للعثور على بياناته وغلافه من Hardcover." />
      ) : loading && (bookMode ? books.length === 0 : items.length === 0) ? (
        <View style={styles.loading}><ActivityIndicator color={colors.accent} size="large" /><Text style={styles.loadingText}>{bookMode ? 'جارٍ البحث عن الكتب…' : searching ? 'جارٍ البحث عن العناوين…' : 'جارٍ تحميل العناوين الرائجة…'}</Text></View>
      ) : failed && (bookMode ? books.length === 0 : items.length === 0) ? (
        <GeneralErrorState title={bookMode ? 'تعذر البحث عن الكتب' : 'تعذر تحميل العناوين'} message="تحقق من اتصال الإنترنت ثم أعد المحاولة." onRetry={refetch} />
      ) : bookMode ? (
        <FlatList data={books} numColumns={3} keyExtractor={(book) => String(book.workId)} contentContainerStyle={styles.grid} columnWrapperStyle={styles.gridRow} keyboardShouldPersistTaps="handled" onEndReached={loadMore} onEndReachedThreshold={0.65} ListEmptyComponent={!bookQuery.isFetching ? <EmptyState icon="search-outline" title="لم نعثر على كتب" message="جرّب عنوانًا أو اسم مؤلف مختلفًا." /> : null} renderItem={({ item }) => <BookCard book={item} width={CARD_WIDTH} onPress={() => { setSelectedItem(item); setSearchOpen(false); }} />} />
      ) : (
        <FlatList data={results} numColumns={3} keyExtractor={(item, index) => `${item.media_type ?? (item.title ? 'movie' : 'tv')}-${item.id}-${index}`} contentContainerStyle={styles.grid} columnWrapperStyle={styles.gridRow} keyboardShouldPersistTaps="handled" onEndReached={loadMore} onEndReachedThreshold={0.65} ListEmptyComponent={!tmdbQuery.isFetching ? <EmptyState icon="search-outline" title={searching ? 'لم نعثر على عناوين' : 'لا توجد عناوين متاحة'} message={searching ? 'جرّب عنوانًا أو تصنيفًا آخر.' : 'ستظهر هنا العناوين الرائجة.'} /> : null} ListFooterComponent={tmdbQuery.isFetching && items.length > 0 ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : tmdbQuery.isError && items.length > 0 ? <Pressable style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.md, marginTop: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface }} onPress={() => void tmdbQuery.refetch()} accessibilityRole="button"><Text style={{ color: colors.accent, fontSize: 11, fontWeight: '800', textAlign: 'center' }}>تعذر تحميل المزيد — اضغط لإعادة المحاولة</Text></Pressable> : null} renderItem={({ item }) => <CreateCard item={item} onPress={() => openReview(item)} />} />
      )}
      </> : null}
    </SafeAreaView>
  );
}

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = (screenWidth - spacing.lg * 2 - spacing.sm * 2) / 3;

function CreateCard({ item, onPress }: { item: TmdbItem; onPress: () => void }) {
  const type = item.media_type ?? (item.title ? 'movie' : 'tv');
  const title = item.title ?? item.name ?? 'عنوان بلا اسم';
  const year = (item.release_date ?? item.first_air_date ?? '').slice(0, 4);
  const poster = item.posterPath ?? item.poster_path;
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`اكتب مراجعة عن ${title}`}><Image source={{ uri: poster ? `https://image.tmdb.org/t/p/w342${poster}` : undefined }} style={styles.poster} resizeMode="cover" /><View style={styles.cardBody}><Text style={styles.cardTitle} numberOfLines={2}>{title}</Text><View style={styles.cardMeta}><Text style={styles.cardType}>{type === 'tv' ? 'مسلسل' : 'فيلم'}</Text>{year ? <Text style={styles.cardYear}>{year}</Text> : null}</View><View style={styles.cardRating}><Ionicons name="star" size={11} color={colors.gold} /><Text style={styles.ratingText}>{(item.voteAverage ?? item.vote_average ?? 0).toFixed(1)}</Text></View></View></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  eyebrow: { color: colors.accent, fontSize: fontSizes.xs, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 3 },
  headerButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  addCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, minHeight: 220, alignItems: 'center', justifyContent: 'center', borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', gap: spacing.sm },
  addIcon: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(51,214,166,0.12)' },
  addTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '900' },
  addHint: { color: colors.textDim, fontSize: fontSizes.xs },
  editor: { flex: 1 },
  selectedCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  selectedPoster: { width: 78, height: 112, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh },
  selectedCopy: { flex: 1, alignItems: 'flex-end', gap: spacing.sm },
  selectedLabel: { color: colors.accent, fontSize: fontSizes.xs, fontWeight: '900' },
  selectedTitle: { color: colors.text, fontSize: fontSizes.lg, lineHeight: 24, fontWeight: '900', textAlign: 'right' },
  changeText: { color: colors.accent, fontSize: fontSizes.xs, fontWeight: '800' },
  editorSection: { marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  editorLabel: { color: colors.text, fontSize: fontSizes.md, fontWeight: '900', textAlign: 'right' },
  ratingStars: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  ratingValue: { color: colors.accent, fontSize: fontSizes.lg, fontWeight: '900', textAlign: 'center', marginTop: spacing.sm },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { color: colors.textDim, fontSize: fontSizes.xs },
  reviewInput: { minHeight: 150, marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: fontSizes.md, lineHeight: 23, textAlign: 'right' },
  reviewHint: { color: colors.textFaint, fontSize: fontSizes.sm, lineHeight: 22, textAlign: 'right', marginTop: spacing.xs },
  publishButton: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.xl, paddingHorizontal: spacing.md, backgroundColor: colors.accent, borderRadius: radius.lg },
  publishText: { color: colors.bg, fontSize: fontSizes.md, fontWeight: '900' },
  disabled: { opacity: 0.6 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.md, paddingHorizontal: spacing.md, minHeight: 48, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: fontSizes.md, textAlign: 'right' },
  grid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  gridRow: { gap: spacing.sm, marginBottom: spacing.sm },
  card: { flex: 1, maxWidth: '32%', overflow: 'hidden', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  poster: { width: '100%', aspectRatio: 0.68, backgroundColor: colors.surfaceHigh },
  cardBody: { padding: spacing.xs },
  cardTitle: { color: colors.text, fontSize: 11, lineHeight: 14, fontWeight: '800', textAlign: 'right' },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  cardType: { color: colors.accent, fontSize: 9, fontWeight: '800' },
  cardYear: { color: colors.textFaint, fontSize: 9 },
  cardRating: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  ratingText: { color: colors.gold, fontSize: 10, fontWeight: '900' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { color: colors.textDim, fontSize: fontSizes.sm },
  loader: { paddingVertical: spacing.md },
});

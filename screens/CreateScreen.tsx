import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import BookCard from '../components/BookCard';
import EmptyState from '../components/EmptyState';
import GeneralErrorState from '../components/GeneralErrorState';
import { trpc } from '../lib/trpc';
import { isAnimeItem } from '../lib/media-categories';
import { ContentStackParamList } from '../navigation/types';
import { BookSummary } from '../types/books';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
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
  const navigation = useNavigation<Nav>();
  const [category, setCategory] = useState<Category>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<TmdbItem[]>([]);
  const [bookPage, setBookPage] = useState(1);
  const [books, setBooks] = useState<BookSummary[]>([]);
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
    const mediaType = item.media_type ?? (item.title ? 'movie' : 'tv');
    navigation.navigate('ReviewModal', { mediaType, mediaId: item.id, title: item.title ?? item.name ?? 'عنوان بلا اسم', posterPath: item.posterPath ?? item.poster_path ?? null, genreIds: item.genre_ids ?? [] });
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
        <Pressable onPress={() => navigation.navigate('Search')} style={styles.headerButton} accessibilityLabel="فتح البحث الكامل"><Ionicons name="search-outline" size={20} color={colors.text} /></Pressable>
      </View>
      <Text style={styles.subtitle}>ابحث عن الأفلام والمسلسلات والأنمي والكتب لكتابة مراجعتك.</Text>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput style={styles.searchInput} placeholder={bookMode ? 'ابحث عن كتاب أو مؤلف…' : 'ابحث عن فيلم أو مسلسل أو أنمي…'} placeholderTextColor={colors.textFaint} value={query} onChangeText={handleQueryChange} autoCorrect={false} returnKeyType="search" />
        {query.length > 0 ? <Pressable onPress={() => handleQueryChange('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.textFaint} /></Pressable> : null}
      </View>
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={CATEGORIES} keyExtractor={(item) => item.key} contentContainerStyle={styles.categories} renderItem={({ item }) => <Pressable onPress={() => setCategory(item.key)} style={[styles.category, category === item.key && styles.categoryActive]} accessibilityRole="tab" accessibilityState={{ selected: category === item.key }}><Ionicons name={item.icon} size={16} color={category === item.key ? colors.bg : colors.textDim} /><Text style={[styles.categoryText, category === item.key && styles.categoryTextActive]}>{item.label}</Text></Pressable>} />
      {bookMode && !bookSearchReady ? (
        <EmptyState icon="book-outline" title="ابحث عن كتاب" message="اكتب اسم كتاب أو مؤلف للعثور على بياناته وغلافه من Hardcover." />
      ) : loading && (bookMode ? books.length === 0 : items.length === 0) ? (
        <View style={styles.loading}><ActivityIndicator color={colors.accent} size="large" /><Text style={styles.loadingText}>{bookMode ? 'جارٍ البحث عن الكتب…' : searching ? 'جارٍ البحث عن العناوين…' : 'جارٍ تحميل العناوين الرائجة…'}</Text></View>
      ) : failed && (bookMode ? books.length === 0 : items.length === 0) ? (
        <GeneralErrorState title={bookMode ? 'تعذر البحث عن الكتب' : 'تعذر تحميل العناوين'} message="تحقق من اتصال الإنترنت ثم أعد المحاولة." onRetry={refetch} />
      ) : bookMode ? (
        <FlatList data={books} numColumns={3} keyExtractor={(book) => String(book.workId)} contentContainerStyle={styles.grid} columnWrapperStyle={styles.gridRow} keyboardShouldPersistTaps="handled" onEndReached={loadMore} onEndReachedThreshold={0.65} ListEmptyComponent={!bookQuery.isFetching ? <EmptyState icon="search-outline" title="لم نعثر على كتب" message="جرّب عنوانًا أو اسم مؤلف مختلفًا." /> : null} ListFooterComponent={bookQuery.isFetching && books.length > 0 ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : bookQuery.isError && books.length > 0 ? <Pressable style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.md, marginTop: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface }} onPress={() => void bookQuery.refetch()} accessibilityRole="button"><Text style={{ color: colors.accent, fontSize: 11, fontWeight: '800', textAlign: 'center' }}>تعذر تحميل المزيد من الكتب — اضغط لإعادة المحاولة</Text></Pressable> : null} renderItem={({ item }) => <BookCard book={item} width={CARD_WIDTH} onPress={() => navigation.navigate('BookDetail', { workId: item.workId, book: item })} />} />
      ) : (
        <FlatList data={results} numColumns={3} keyExtractor={(item, index) => `${item.media_type ?? (item.title ? 'movie' : 'tv')}-${item.id}-${index}`} contentContainerStyle={styles.grid} columnWrapperStyle={styles.gridRow} keyboardShouldPersistTaps="handled" onEndReached={loadMore} onEndReachedThreshold={0.65} ListEmptyComponent={!tmdbQuery.isFetching ? <EmptyState icon="search-outline" title={searching ? 'لم نعثر على عناوين' : 'لا توجد عناوين متاحة'} message={searching ? 'جرّب عنوانًا أو تصنيفًا آخر.' : 'ستظهر هنا العناوين الرائجة.'} /> : null} ListFooterComponent={tmdbQuery.isFetching && items.length > 0 ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : tmdbQuery.isError && items.length > 0 ? <Pressable style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.md, marginTop: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface }} onPress={() => void tmdbQuery.refetch()} accessibilityRole="button"><Text style={{ color: colors.accent, fontSize: 11, fontWeight: '800', textAlign: 'center' }}>تعذر تحميل المزيد — اضغط لإعادة المحاولة</Text></Pressable> : null} renderItem={({ item }) => <CreateCard item={item} onPress={() => openReview(item)} />} />
      )}
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
  safe: { flex: 1, backgroundColor: colors.bg }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md }, eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 4 }, subtitle: { color: colors.textDim, fontSize: fontSizes.sm, lineHeight: 21, paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.lg, textAlign: 'right' }, headerButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, searchBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, paddingHorizontal: spacing.md, minHeight: 48, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, searchInput: { flex: 1, color: colors.text, fontSize: fontSizes.md, textAlign: 'right' }, categories: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg }, category: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, categoryActive: { backgroundColor: colors.accent, borderColor: colors.accent }, categoryText: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '800' }, categoryTextActive: { color: colors.bg }, grid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }, gridRow: { gap: spacing.sm, marginBottom: spacing.sm }, card: { flex: 1, maxWidth: '32%', overflow: 'hidden', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }, poster: { width: '100%', aspectRatio: 0.68, backgroundColor: colors.surfaceHigh }, cardBody: { padding: spacing.xs }, cardTitle: { color: colors.text, fontSize: 11, lineHeight: 14, fontWeight: '800', textAlign: 'right' }, cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }, cardType: { color: colors.accent, fontSize: 9, fontWeight: '800' }, cardYear: { color: colors.textFaint, fontSize: 9 }, cardRating: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }, ratingText: { color: colors.gold, fontSize: 10, fontWeight: '900' }, pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, loadingText: { color: colors.textDim, fontSize: fontSizes.sm }, loader: { paddingVertical: spacing.md },
});

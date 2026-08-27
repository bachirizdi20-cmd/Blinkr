import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { trpc } from '../lib/trpc';
import { ContentStackParamList } from '../navigation/types';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import EmptyState from '../components/EmptyState';
import GeneralErrorState from '../components/GeneralErrorState';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type Category = 'all' | 'movie' | 'tv' | 'anime' | 'book';
const CATEGORIES: { key: Category; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'all', label: 'All', icon: 'sparkles-outline' },
  { key: 'movie', label: 'Films', icon: 'film-outline' },
  { key: 'tv', label: 'Series', icon: 'tv-outline' },
  { key: 'anime', label: 'Anime', icon: 'color-wand-outline' },
  { key: 'book', label: 'Books', icon: 'book-outline' },
];

export default function CreateScreen() {
  const navigation = useNavigation<Nav>();
  const [category, setCategory] = useState<Category>('all');
  const [query, setQuery] = useState('');
  const [bookPage, setBookPage] = useState(1);
  const [bookResults, setBookResults] = useState<any[]>([]);
  const searchQuery = trpc.tmdb.get.useQuery({ path: '/search/multi', params: { query: query.trim(), include_adult: false } }, { enabled: query.trim().length >= 2, retry: 1 });
  const booksQuery = trpc.books.search.useQuery({ query, page: bookPage, limit: 24 }, { enabled: category === 'book', retry: 1 });
  useEffect(() => {
    if (!booksQuery.data) return;
    setBookResults((current) => bookPage === 1 ? booksQuery.data.results : [...current, ...booksQuery.data.results]);
  }, [booksQuery.data, bookPage]);

  const results = useMemo(() => {
    const items = ((searchQuery.data as any)?.results ?? []).filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv');
    if (category === 'book') return [];
    if (category === 'all') return items;
    if (category === 'anime') return items.filter((item: any) => Array.isArray(item.genre_ids) && item.genre_ids.includes(16));
    return items.filter((item: any) => item.media_type === category);
  }, [searchQuery.data, category]);

  const openReview = (item: any) => navigation.navigate('ReviewModal', {
    mediaType: item.media_type,
    mediaId: item.id,
    title: item.title ?? item.name ?? 'Untitled',
    posterPath: item.posterPath ?? null,
      genreIds: item.genre_ids ?? [],
  });

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (category === 'book') {
      setBookPage(1);
      setBookResults([]);
    }
  };

  const openBookReview = (book: any) => navigation.navigate('BookDetail', { book });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}><View><Text style={styles.eyebrow}>CREATE</Text><Text style={styles.title}>Share your take</Text></View><Pressable onPress={() => navigation.navigate('Search')} style={styles.headerButton} accessibilityLabel="Open full search"><Ionicons name="search-outline" size={20} color={colors.text} /></Pressable></View>
      <Text style={styles.subtitle}>Find something you watched and make it part of your story.</Text>
      <View style={styles.searchBar}><Ionicons name="search" size={18} color={colors.textFaint} /><TextInput style={styles.searchInput} placeholder={category === 'book' ? 'Search books, authors, ISBN...' : 'Search films, series, anime...'} placeholderTextColor={colors.textFaint} value={query} onChangeText={handleQueryChange} autoCorrect={false} returnKeyType="search" />{query.length > 0 ? <Pressable onPress={() => handleQueryChange('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.textFaint} /></Pressable> : null}</View>
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={CATEGORIES} keyExtractor={(item) => item.key} contentContainerStyle={styles.categories} renderItem={({ item }) => <Pressable onPress={() => setCategory(item.key)} style={[styles.category, category === item.key && styles.categoryActive]} accessibilityRole="tab" accessibilityState={{ selected: category === item.key }}><Ionicons name={item.icon} size={16} color={category === item.key ? colors.bg : colors.textDim} /><Text style={[styles.categoryText, category === item.key && styles.categoryTextActive]}>{item.label}</Text></Pressable>} />
      {category === 'book' ? (booksQuery.isLoading && bookResults.length === 0 ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : booksQuery.isError && bookResults.length === 0 ? <GeneralErrorState title="Could not load books" message="Check your connection and try again." onRetry={() => booksQuery.refetch()} /> : <FlatList data={bookResults} numColumns={3} keyExtractor={(item: any) => `${item.bookKey}-${item.id}`} contentContainerStyle={styles.bookGrid} columnWrapperStyle={styles.bookRow} onEndReached={() => { if (!booksQuery.isFetching && booksQuery.data?.hasMore) setBookPage((page) => page + 1); }} onEndReachedThreshold={0.65} ListEmptyComponent={!booksQuery.isFetching ? <EmptyState icon="book-outline" title="No books found" message="Try another title or author." /> : null} ListFooterComponent={booksQuery.isFetching && bookResults.length > 0 ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null} renderItem={({ item }: { item: any }) => <Pressable onPress={() => openBookReview(item)} style={({ pressed }) => [styles.bookCard, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Write a review for ${item.title}`}><Image source={{ uri: item.coverUrl ?? undefined }} style={styles.bookCover} /><Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text><Text style={styles.bookMeta} numberOfLines={1}>{item.authors?.[0] ?? 'Unknown author'}</Text><Text style={styles.bookYear}>{item.publishedYear ?? '—'}</Text></Pressable>} />) : (searchQuery.isLoading ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : searchQuery.isError ? <GeneralErrorState title="Could not search TMDB" message="Check your connection and try again." onRetry={() => searchQuery.refetch()} /> : query.trim().length < 2 ? <EmptyState icon="create-outline" title="Start creating" message="Search for a film, series, anime, or book to write a review and share it with the community." /> : <FlatList data={results} keyExtractor={(item: any) => `${item.media_type}-${item.id}`} contentContainerStyle={styles.results} ListEmptyComponent={<EmptyState icon="search-outline" title="No titles found" message="Try another title or category." />} renderItem={({ item }: { item: any }) => <Pressable onPress={() => openReview(item)} style={({ pressed }) => [styles.result, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Write a review for ${item.title ?? item.name}`}><Image source={{ uri: item.posterPath ? `https://image.tmdb.org/t/p/w200${item.posterPath}` : undefined }} style={styles.poster} /><View style={styles.resultCopy}><Text style={styles.resultTitle} numberOfLines={2}>{item.title ?? item.name}</Text><Text style={styles.meta}>{item.media_type === 'tv' ? 'Series' : 'Film'} · ★ {(item.voteAverage ?? 0).toFixed(1)}</Text><Text style={styles.cta}>Write a review <Ionicons name="arrow-forward" size={13} color={colors.accent} /></Text></View><Ionicons name="chevron-forward" size={18} color={colors.textFaint} /></Pressable>} />)}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 4 },
  subtitle: { color: colors.textDim, fontSize: fontSizes.sm, lineHeight: 20, paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.lg },
  headerButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, paddingHorizontal: spacing.md, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: fontSizes.md },
  categories: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  category: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  categoryActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  categoryText: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '800' },
  categoryTextActive: { color: colors.bg },
  loader: { marginTop: spacing.xl },
  results: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  bookGrid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  bookRow: { gap: spacing.sm, marginBottom: spacing.md },
  bookCard: { flex: 1, maxWidth: '32%', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.xs, borderWidth: 1, borderColor: colors.border },
  bookCover: { width: '100%', aspectRatio: 0.68, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh },
  bookTitle: { color: colors.text, fontSize: 11, fontWeight: '800', lineHeight: 14, marginTop: spacing.xs },
  bookMeta: { color: colors.textDim, fontSize: 10, marginTop: 3 },
  bookYear: { color: colors.accent, fontSize: 10, fontWeight: '800', marginTop: 3 },
  result: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
  poster: { width: 58, height: 82, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh },
  resultCopy: { flex: 1, gap: 4 },
  resultTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '800' },
  meta: { color: colors.textDim, fontSize: fontSizes.xs },
  cta: { color: colors.accent, fontSize: fontSizes.xs, fontWeight: '900' },
});

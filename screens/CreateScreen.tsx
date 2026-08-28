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
type Category = 'all' | 'movie' | 'tv' | 'anime';
type TmdbItem = { id: number; media_type?: 'movie' | 'tv'; title?: string; name?: string; poster_path?: string | null; posterPath?: string | null; overview?: string; vote_average?: number; voteAverage?: number; first_air_date?: string; release_date?: string; genre_ids?: number[] };
const CATEGORIES: { key: Category; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'all', label: 'All', icon: 'sparkles-outline' },
  { key: 'movie', label: 'Films', icon: 'film-outline' },
  { key: 'tv', label: 'Series', icon: 'tv-outline' },
  { key: 'anime', label: 'Anime', icon: 'color-wand-outline' },
];

export default function CreateScreen() {
  const navigation = useNavigation<Nav>();
  const [category, setCategory] = useState<Category>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<TmdbItem[]>([]);
  const trimmed = query.trim();
  const searching = trimmed.length >= 2;
  const path = searching ? '/search/multi' : '/trending/all/week';
  const tmdbQuery = trpc.tmdb.get.useQuery({ path, params: { page, include_adult: false, ...(searching ? { query: trimmed } : {}) } }, { retry: 1 });

  useEffect(() => { setPage(1); setItems([]); }, [trimmed]);
  useEffect(() => {
    const next = ((tmdbQuery.data as any)?.results ?? []).filter((item: TmdbItem) => item.media_type === 'movie' || item.media_type === 'tv' || (!item.media_type && (item.title || item.release_date)));
    setItems((current) => page === 1 ? next : [...current, ...next.filter((item: TmdbItem) => !current.some((existing) => existing.id === item.id && (existing.media_type ?? '') === (item.media_type ?? '')))]);
  }, [tmdbQuery.data, page]);

  const results = useMemo(() => items.filter((item) => {
    const type = item.media_type ?? (item.title ? 'movie' : 'tv');
    if (category === 'all') return true;
    if (category === 'anime') return item.genre_ids?.includes(16) ?? false;
    return type === category;
  }), [items, category]);

  const openReview = (item: TmdbItem) => {
    const mediaType = item.media_type ?? (item.title ? 'movie' : 'tv');
    navigation.navigate('ReviewModal', { mediaType, mediaId: item.id, title: item.title ?? item.name ?? 'Untitled', posterPath: item.posterPath ?? item.poster_path ?? null, genreIds: item.genre_ids ?? [] });
  };
  const handleQueryChange = (value: string) => { setQuery(value); setPage(1); setItems([]); };
  const hasMore = Number((tmdbQuery.data as any)?.total_pages ?? 1) > page;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}><View><Text style={styles.eyebrow}>CREATE</Text><Text style={styles.title}>Share your take</Text></View><Pressable onPress={() => navigation.navigate('Search')} style={styles.headerButton} accessibilityLabel="Open full search"><Ionicons name="search-outline" size={20} color={colors.text} /></Pressable></View>
      <Text style={styles.subtitle}>Discover films, series, and anime in one place.</Text>
      <View style={styles.searchBar}><Ionicons name="search" size={18} color={colors.textFaint} /><TextInput style={styles.searchInput} placeholder="Search films, series, or anime..." placeholderTextColor={colors.textFaint} value={query} onChangeText={handleQueryChange} autoCorrect={false} returnKeyType="search" />{query.length > 0 ? <Pressable onPress={() => handleQueryChange('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.textFaint} /></Pressable> : null}</View>
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={CATEGORIES} keyExtractor={(item) => item.key} contentContainerStyle={styles.categories} renderItem={({ item }) => <Pressable onPress={() => setCategory(item.key)} style={[styles.category, category === item.key && styles.categoryActive]} accessibilityRole="tab" accessibilityState={{ selected: category === item.key }}><Ionicons name={item.icon} size={16} color={category === item.key ? colors.bg : colors.textDim} /><Text style={[styles.categoryText, category === item.key && styles.categoryTextActive]}>{item.label}</Text></Pressable>} />
      {tmdbQuery.isLoading && items.length === 0 ? <View style={styles.loading}><ActivityIndicator color={colors.accent} size="large" /><Text style={styles.loadingText}>{searching ? 'Searching titles…' : 'Loading what is trending…'}</Text></View> : tmdbQuery.isError && items.length === 0 ? <GeneralErrorState title="Could not load titles" message="Check your connection and try again." onRetry={() => tmdbQuery.refetch()} /> : <FlatList data={results} numColumns={3} keyExtractor={(item, index) => `${item.media_type ?? (item.title ? 'movie' : 'tv')}-${item.id}-${index}`} contentContainerStyle={styles.grid} columnWrapperStyle={styles.gridRow} keyboardShouldPersistTaps="handled" onEndReached={() => { if (!tmdbQuery.isFetching && hasMore) setPage((value) => value + 1); }} onEndReachedThreshold={0.65} ListEmptyComponent={!tmdbQuery.isFetching ? <EmptyState icon="search-outline" title={searching ? 'No titles found' : 'Nothing available'} message={searching ? 'Try another title or category.' : 'Trending titles will appear here.'} /> : null} ListFooterComponent={tmdbQuery.isFetching && items.length > 0 ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null} renderItem={({ item }) => <CreateCard item={item} onPress={() => openReview(item)} />} />}
    </SafeAreaView>
  );
}

function CreateCard({ item, onPress }: { item: TmdbItem; onPress: () => void }) {
  const type = item.media_type ?? (item.title ? 'movie' : 'tv');
  const title = item.title ?? item.name ?? 'Untitled';
  const year = (item.release_date ?? item.first_air_date ?? '').slice(0, 4);
  const poster = item.posterPath ?? item.poster_path;
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Write a review for ${title}`}><Image source={{ uri: poster ? `https://image.tmdb.org/t/p/w342${poster}` : undefined }} style={styles.poster} resizeMode="cover" /><View style={styles.cardBody}><Text style={styles.cardTitle} numberOfLines={2}>{title}</Text><View style={styles.cardMeta}><Text style={styles.cardType}>{type === 'tv' ? 'TV' : 'Film'}</Text>{year ? <Text style={styles.cardYear}>{year}</Text> : null}</View><View style={styles.cardRating}><Ionicons name="star" size={11} color={colors.gold} /><Text style={styles.ratingText}>{(item.voteAverage ?? item.vote_average ?? 0).toFixed(1)}</Text></View></View></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md }, eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.8 }, title: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 4 }, subtitle: { color: colors.textDim, fontSize: fontSizes.sm, lineHeight: 20, paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.lg }, headerButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, searchBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, paddingHorizontal: spacing.md, minHeight: 48, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, searchInput: { flex: 1, color: colors.text, fontSize: fontSizes.md }, categories: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg }, category: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, categoryActive: { backgroundColor: colors.accent, borderColor: colors.accent }, categoryText: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '800' }, categoryTextActive: { color: colors.bg }, grid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }, gridRow: { gap: spacing.sm, marginBottom: spacing.sm }, card: { flex: 1, maxWidth: '32%', overflow: 'hidden', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }, poster: { width: '100%', aspectRatio: 0.68, backgroundColor: colors.surfaceHigh }, cardBody: { padding: spacing.xs }, cardTitle: { color: colors.text, fontSize: 11, lineHeight: 14, fontWeight: '800' }, cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }, cardType: { color: colors.accent, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }, cardYear: { color: colors.textFaint, fontSize: 9 }, cardRating: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }, ratingText: { color: colors.gold, fontSize: 10, fontWeight: '900' }, pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, loadingText: { color: colors.textDim, fontSize: fontSizes.sm }, loader: { paddingVertical: spacing.md },
});

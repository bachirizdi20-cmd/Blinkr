import React, { useEffect, useState } from 'react';
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
type MediaTab = 'movie' | 'tv';

type BrowseItem = {
  id: number;
  mediaType: MediaTab;
  title: string;
  posterPath: string | null;
  date: string;
  voteAverage: number;
  overview: string;
  genreIds: number[];
};

function normalizeItem(item: any, fallbackType: MediaTab): BrowseItem | null {
  if (!item?.id) return null;
  const mediaType: MediaTab = item.media_type === 'tv' || fallbackType === 'tv' ? 'tv' : 'movie';
  return {
    id: Number(item.id),
    mediaType,
    title: item.title ?? item.name ?? 'Untitled',
    posterPath: item.posterPath ?? item.poster_path ?? null,
    date: item.date ?? item.release_date ?? item.first_air_date ?? '',
    voteAverage: Number(item.voteAverage ?? item.vote_average ?? 0),
    overview: item.overview ?? '',
    genreIds: item.genreIds ?? item.genre_ids ?? [],
  };
}

export default function CreateScreen() {
  const navigation = useNavigation<Nav>();
  const [activeTab, setActiveTab] = useState<MediaTab>('movie');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length >= 2;
  const path = isSearching ? '/search/multi' : activeTab === 'movie' ? '/movie/popular' : '/tv/popular';
  const params: Record<string, string | number | boolean> = isSearching
    ? { query: trimmedQuery, page, include_adult: false }
    : { page };
  const browseQuery = trpc.tmdb.get.useQuery({ path, params }, { retry: 1 });

  useEffect(() => {
    setPage(1);
    setItems([]);
    setHasMore(true);
  }, [activeTab, trimmedQuery]);

  useEffect(() => {
    const data = browseQuery.data as any;
    if (!data) return;
    const normalized: BrowseItem[] = (data.results ?? [])
      .map((item: any) => normalizeItem(item, activeTab))
      .filter((item: BrowseItem | null): item is BrowseItem => Boolean(item))
      .filter((item: BrowseItem) => !isSearching || item.mediaType === activeTab);
    setItems((current) => {
      const base = page === 1 ? [] : current;
      const seen = new Set(base.map((item: BrowseItem) => `${item.mediaType}-${item.id}`));
      return [...base, ...normalized.filter((item: BrowseItem) => !seen.has(`${item.mediaType}-${item.id}`))];
    });
    const totalPages = Math.min(Number(data.total_pages ?? 1), 500);
    setHasMore(page < totalPages && normalized.length > 0);
  }, [browseQuery.data, page, activeTab, isSearching]);

  const openReview = (item: BrowseItem) => {
    navigation.navigate('ReviewModal', {
      mediaType: item.mediaType,
      mediaId: item.id,
      title: item.title,
      posterPath: item.posterPath,
      genreIds: item.genreIds,
    });
  };

  const loadMore = () => {
    if (browseQuery.isFetching || !hasMore || items.length === 0) return;
    setPage((current) => current + 1);
  };

  const renderItem = ({ item }: { item: BrowseItem }) => (
    <Pressable onPress={() => openReview(item)} style={({ pressed }) => [styles.card, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Write a review for ${item.title}`}>
      <Image source={item.posterPath ? { uri: `https://image.tmdb.org/t/p/w342${item.posterPath}` } : undefined} style={styles.poster} />
      <View style={styles.cardBody}>
        <View style={styles.cardTopline}><Text style={styles.mediaPill}>{item.mediaType === 'movie' ? 'MOVIE' : 'TV SHOW'}</Text><Text style={styles.rating}><Ionicons name="star" size={12} color={colors.accent} /> {item.voteAverage > 0 ? item.voteAverage.toFixed(1) : '—'}</Text></View>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardMeta}>{item.date ? item.date.slice(0, 4) : 'Release date unavailable'}{item.overview ? ` · ${item.overview}` : ''}</Text>
        <View style={styles.reviewCta}><Text style={styles.reviewCtaText}>Write a review</Text><Ionicons name="arrow-forward" size={15} color={colors.accent} /></View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );

  const firstLoading = browseQuery.isLoading && page === 1;
  const showError = browseQuery.isError && items.length === 0;
  const showEmpty = !firstLoading && !showError && items.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View><Text style={styles.eyebrow}>CREATE</Text><Text style={styles.title}>Share your take</Text></View>
        <Pressable onPress={() => navigation.navigate('Search')} style={styles.headerButton} accessibilityLabel="Open full search"><Ionicons name="search-outline" size={20} color={colors.text} /></Pressable>
      </View>
      <Text style={styles.subtitle}>Find something you watched and turn it into a story.</Text>
      <View style={styles.searchBar}><Ionicons name="search" size={18} color={colors.textFaint} /><TextInput style={styles.searchInput} placeholder="Search films and TV shows..." placeholderTextColor={colors.textFaint} value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" />{query.length > 0 ? <Pressable onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.textFaint} /></Pressable> : null}</View>
      <View style={styles.tabs} accessibilityRole="tablist">
        <Pressable onPress={() => setActiveTab('movie')} style={[styles.tab, activeTab === 'movie' && styles.tabActive]} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'movie' }}><Ionicons name="film-outline" size={17} color={activeTab === 'movie' ? colors.bg : colors.textDim} /><Text style={[styles.tabText, activeTab === 'movie' && styles.tabTextActive]}>Movies</Text></Pressable>
        <Pressable onPress={() => setActiveTab('tv')} style={[styles.tab, activeTab === 'tv' && styles.tabActive]} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'tv' }}><Ionicons name="tv-outline" size={17} color={activeTab === 'tv' ? colors.bg : colors.textDim} /><Text style={[styles.tabText, activeTab === 'tv' && styles.tabTextActive]}>TV Shows</Text></Pressable>
      </View>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{isSearching ? `Results for “${trimmedQuery}”` : activeTab === 'movie' ? 'Popular movies' : 'Popular TV shows'}</Text><View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>TMDB LIVE</Text></View></View>
      {firstLoading ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : showError ? <GeneralErrorState title="Could not load titles" message="Check your connection and try again." onRetry={() => browseQuery.refetch()} /> : showEmpty ? <EmptyState icon="film-outline" title="No titles found" message="Try another search or switch between Movies and TV Shows." /> : <FlatList data={items} keyExtractor={(item) => `${item.mediaType}-${item.id}`} renderItem={renderItem} onEndReached={loadMore} onEndReachedThreshold={0.55} contentContainerStyle={styles.results} showsVerticalScrollIndicator={false} ListFooterComponent={browseQuery.isFetching && page > 1 ? <View style={styles.footer}><ActivityIndicator color={colors.accent} /><Text style={styles.footerText}>Loading more titles…</Text></View> : !hasMore ? <Text style={styles.endText}>You reached the end of this list</Text> : null} />}
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
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '900' },
  tabTextActive: { color: colors.bg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '900' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  liveText: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  loader: { flex: 1 },
  results: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
  poster: { width: 72, height: 104, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh },
  cardBody: { flex: 1, minWidth: 0, gap: 5 },
  cardTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mediaPill: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  rating: { color: colors.textDim, fontSize: 11, fontWeight: '800' },
  cardTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '900', lineHeight: 20 },
  cardMeta: { color: colors.textDim, fontSize: fontSizes.xs, lineHeight: 17 },
  reviewCta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  reviewCtaText: { color: colors.accent, fontSize: fontSizes.xs, fontWeight: '900' },
  footer: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  footerText: { color: colors.textDim, fontSize: fontSizes.xs },
  endText: { color: colors.textFaint, textAlign: 'center', fontSize: fontSizes.xs, paddingVertical: spacing.lg },
});

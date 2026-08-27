import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PosterCard from '../components/PosterCard';
import EmptyState from '../components/EmptyState';
import ApiErrorState from '../components/ApiErrorState';
import UserAvatar from '../components/UserAvatar';
import { ContentStackParamList } from '../navigation/types';
import { searchMulti } from '../lib/tmdb';
import { NormalizedItem } from '../types/tmdb';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/use-auth';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type Tab = 'all' | 'people' | 'movies' | 'tv' | 'books' | 'reviews';
const tabs: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'people', label: 'People' }, { key: 'movies', label: 'Movies' },
  { key: 'tv', label: 'TV' }, { key: 'books', label: 'Books' }, { key: 'reviews', label: 'Reviews' },
];

export default function SearchScreen() {
  const navigation = useNavigation<Nav>();
  const { user: authUser } = useAuth();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [mediaResults, setMediaResults] = useState<NormalizedItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const trimmed = query.trim();
  const shouldSearch = trimmed.length >= 2;
  const peopleQuery = trpc.social.users.useQuery({ query: trimmed }, { enabled: Boolean(authUser) && shouldSearch, retry: 1 });
  const booksQuery = trpc.books.search.useQuery({ query: trimmed, page: 1, limit: 24 }, { enabled: shouldSearch, retry: 1 });
  const reviewsQuery = trpc.social.searchReviews.useQuery({ query: trimmed }, { enabled: Boolean(authUser) && shouldSearch, retry: 1 });

  useEffect(() => {
    let active = true;
    if (!shouldSearch || tab === 'people' || tab === 'books' || tab === 'reviews') { setMediaResults([]); setMediaLoading(false); return; }
    setMediaLoading(true); setMediaError(null);
    searchMulti(trimmed, 1).then((data) => { if (active) setMediaResults(data.results.filter((item) => item.mediaType === 'movie' || item.mediaType === 'tv')); }).catch((error) => { if (active) setMediaError(error instanceof Error ? error.message : 'Unable to search titles right now.'); }).finally(() => { if (active) setMediaLoading(false); });
    return () => { active = false; };
  }, [trimmed, tab, shouldSearch]);

  const media = mediaResults.filter((item) => tab === 'all' || tab === 'movies' ? item.mediaType === 'movie' : tab === 'tv' ? item.mediaType === 'tv' : true);
  const people = peopleQuery.data ?? [];
  const books = booksQuery.data?.results ?? [];
  const reviews = reviewsQuery.data ?? [];
  const isLoading = tab === 'people' ? peopleQuery.isLoading : tab === 'books' ? booksQuery.isLoading : tab === 'reviews' ? reviewsQuery.isLoading : mediaLoading;
  const hasError = tab === 'people' ? peopleQuery.error : tab === 'books' ? booksQuery.error : tab === 'reviews' ? reviewsQuery.error : mediaError;

  const renderBook = (book: any) => (
    <Pressable key={book.bookKey} style={styles.bookRow} onPress={() => navigation.navigate('BookDetail', { book })}>
      {book.coverUrl ? <Image source={{ uri: book.coverUrl }} style={styles.bookCover} /> : <View style={[styles.bookCover, styles.coverFallback]}><Ionicons name="book-outline" size={22} color={colors.textFaint} /></View>}
      <View style={styles.resultCopy}><Text style={styles.resultTitle} numberOfLines={2}>{book.title}</Text><Text style={styles.resultMeta} numberOfLines={1}>{(book.authors ?? []).join(', ') || 'Unknown author'}</Text><Text style={styles.resultSub}>{book.publishedYear ?? '—'}{book.ratingAverage ? `  ·  ★ ${book.ratingAverage.toFixed(1)}` : ''}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.header}>Search</Text>
      <View style={styles.searchBar}><Ionicons name="search" size={19} color={colors.textFaint} /><TextInput style={styles.input} placeholder="Search people, reviews, movies, TV or books..." placeholderTextColor={colors.textFaint} value={query} onChangeText={setQuery} returnKeyType="search" autoCorrect={false} />{query ? <Pressable onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.textFaint} /></Pressable> : null}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {tabs.map((item) => <Pressable key={item.key} onPress={() => setTab(item.key)} style={[styles.tab, tab === item.key && styles.tabActive]}><Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text></Pressable>)}
      </ScrollView>
      {!shouldSearch ? <EmptyState icon="search-outline" title="Search your movie circle" message="Find people, reviews, movies, shows, and books in one place." /> : isLoading ? <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /><Text style={styles.loadingText}>Searching Blinkr…</Text></View> : hasError ? <ApiErrorState message={hasError instanceof Error ? hasError.message : 'Search is temporarily unavailable.'} onRetry={() => { peopleQuery.refetch(); booksQuery.refetch(); reviewsQuery.refetch(); }} /> : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {(tab === 'all' || tab === 'people') && people.length > 0 ? <Section title="People" action={() => setTab('people')}><View>{people.slice(0, tab === 'people' ? 50 : 5).map((person: any) => <Pressable key={person.id} style={styles.personRow} onPress={() => navigation.navigate('UserProfile', { userId: String(person.id) })}><UserAvatar name={person.name || person.username} color={colors.accent} size={42} /><View style={styles.resultCopy}><Text style={styles.resultTitle}>{person.name || person.username}</Text><Text style={styles.resultMeta}>@{person.username}</Text>{person.bio ? <Text style={styles.resultSub} numberOfLines={1}>{person.bio}</Text> : null}</View><Ionicons name="chevron-forward" size={18} color={colors.textFaint} /></Pressable>)}</View></Section> : null}
          {(tab === 'all' || tab === 'movies' || tab === 'tv') && media.length > 0 ? <Section title={tab === 'all' ? 'Movies & TV' : tab === 'movies' ? 'Movies' : 'TV shows'} action={() => setTab(tab === 'tv' ? 'tv' : 'movies')}><View style={styles.mediaGrid}>{media.slice(0, tab === 'all' ? 6 : 30).map((item) => <PosterCard key={`${item.mediaType}-${item.id}`} item={item} width={108} onPress={() => navigation.navigate('Detail', { mediaType: item.mediaType, id: item.id })} />)}</View></Section> : null}
          {(tab === 'all' || tab === 'books') && books.length > 0 ? <Section title="Books" action={() => setTab('books')}><View>{books.slice(0, tab === 'all' ? 5 : 30).map(renderBook)}</View></Section> : null}
          {(tab === 'all' || tab === 'reviews') && reviews.length > 0 ? <Section title="Reviews" action={() => setTab('reviews')}><View>{reviews.slice(0, tab === 'all' ? 5 : 50).map((row: any) => <Pressable key={row.review.id} style={styles.reviewRow} onPress={() => row.review.mediaType === 'book' ? navigation.navigate('ReviewModal', { mediaType: 'book', mediaId: row.review.mediaId, title: row.review.title, posterPath: row.review.posterPath }) : navigation.navigate('Detail', { mediaType: row.review.mediaType, id: row.review.mediaId })}><UserAvatar name={row.displayName || row.username} color={colors.accent} size={38} /><View style={styles.resultCopy}><Text style={styles.reviewAuthor}>{row.displayName || row.username} <Text style={styles.reviewMuted}>reviewed</Text></Text><Text style={styles.resultTitle} numberOfLines={1}>{row.review.title}</Text><Text style={styles.reviewText} numberOfLines={2}>{row.review.review}</Text><Text style={styles.rating}>★ {(row.review.rating / 10).toFixed(1)}</Text></View></Pressable>)}</View></Section> : null}
          {people.length === 0 && media.length === 0 && books.length === 0 && reviews.length === 0 ? <EmptyState icon="search-outline" title="No results found" message="Try a different name, title, author, or review phrase." /> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Section({ title, action, children }: { title: string; action: () => void; children: React.ReactNode }) { return <View style={styles.section}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text><Pressable onPress={action}><Text style={styles.seeAll}>See all</Text></Pressable></View>{children}</View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg }, header: { color: colors.text, fontSize: fontSizes.xxl, fontWeight: '900', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 48, borderWidth: 1, borderColor: colors.border }, input: { flex: 1, color: colors.text, fontSize: fontSizes.md },
  tabs: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }, tab: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, tabActive: { backgroundColor: colors.accent, borderColor: colors.accent }, tabText: { color: colors.textDim, fontSize: 12, fontWeight: '800' }, tabTextActive: { color: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 36 }, section: { marginBottom: spacing.lg }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }, sectionTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '900' }, seeAll: { color: colors.accent, fontSize: 12, fontWeight: '800' }, personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }, bookRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }, bookCover: { width: 46, height: 64, borderRadius: 5, backgroundColor: colors.surfaceHigh }, coverFallback: { alignItems: 'center', justifyContent: 'center' }, resultCopy: { flex: 1, minWidth: 0 }, resultTitle: { color: colors.text, fontSize: 14, fontWeight: '800' }, resultMeta: { color: colors.textDim, fontSize: 12, marginTop: 3 }, resultSub: { color: colors.textFaint, fontSize: 11, marginTop: 3 }, mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, reviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }, reviewAuthor: { color: colors.text, fontSize: 13, fontWeight: '800' }, reviewMuted: { color: colors.textDim, fontWeight: '500' }, reviewText: { color: colors.textDim, fontSize: 12, lineHeight: 18, marginTop: 3 }, rating: { color: colors.gold, fontSize: 12, fontWeight: '800', marginTop: 3 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, loadingText: { color: colors.textDim, fontSize: 12 },
});

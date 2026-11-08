import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import BookCard from '../components/BookCard';
import ComicCard from '../components/ComicCard';
import PosterCard from '../components/PosterCard';
import EmptyState from '../components/EmptyState';
import ApiErrorState from '../components/ApiErrorState';
import UserAvatar from '../components/UserAvatar';
import { ContentStackParamList } from '../navigation/types';
import { searchMulti } from '../lib/tmdb';
import { NormalizedItem, ReviewMediaType } from '../types/tmdb';
import { BookSummary } from '../types/books';
import { ComicSummary } from '../types/comics';
import { openCatalogItem } from '../lib/catalog-navigation';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/use-auth';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type SearchRoute = RouteProp<ContentStackParamList, 'Search'>;
type Tab = 'all' | 'people' | 'movies' | 'tv' | 'books' | 'comics' | 'reviews';
const tabs: { key: Tab; label: string }[] = [
  { key: 'all', label: 'الكل' }, { key: 'people', label: 'الأشخاص' }, { key: 'movies', label: 'الأفلام' },
  { key: 'tv', label: 'المسلسلات' }, { key: 'books', label: 'الكتب' }, { key: 'comics', label: 'الكوميك' }, { key: 'reviews', label: 'المراجعات' },
];

export default function SearchScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<SearchRoute>();
  const mediaOnly = Boolean(route.params?.mediaOnly);
  const booksTrending = Boolean(route.params?.booksTrending);
  const { user: authUser } = useAuth();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>(booksTrending ? 'books' : mediaOnly ? 'movies' : 'all');
  const [mediaResults, setMediaResults] = useState<NormalizedItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaRetry, setMediaRetry] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const recentSearchesRef = useRef<string[]>([]);
  const setRecent = (items: string[]) => { recentSearchesRef.current = items; setRecentSearches(items); };
  const [searchFocused, setSearchFocused] = useState(false);
  const [bookPage, setBookPage] = useState(1);
  const [bookResults, setBookResults] = useState<BookSummary[]>([]);
  const [comicPage, setComicPage] = useState(1);
  const [comicResults, setComicResults] = useState<ComicSummary[]>([]);
  const trimmed = query.trim();
  const [debouncedQuery, setDebouncedQuery] = useState(trimmed);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(trimmed), 350);
    return () => clearTimeout(timer);
  }, [trimmed]);
  const shouldSearch = debouncedQuery.length >= 2 && trimmed === debouncedQuery;
  const peopleQuery = trpc.social.users.useQuery({ query: debouncedQuery }, { enabled: Boolean(authUser) && shouldSearch && !mediaOnly, retry: 1 });
  const reviewsQuery = trpc.social.searchReviews.useQuery({ query: debouncedQuery }, { enabled: Boolean(authUser) && shouldSearch && !mediaOnly, retry: 1 });
  const booksQuery = trpc.books.search.useQuery(
    { query: debouncedQuery, page: bookPage, limit: 20 },
    { enabled: shouldSearch && !mediaOnly && !booksTrending && (tab === 'all' || tab === 'books'), retry: 1 },
  );
  const trendingBooksQuery = trpc.books.trending.useQuery({ limit: 100 }, { enabled: booksTrending, retry: 1 });
  const comicsQuery = trpc.comics.search.useQuery({ query: debouncedQuery, page: comicPage, limit: 20 }, { enabled: shouldSearch && !mediaOnly && (tab === 'all' || tab === 'comics'), retry: 1 });
  const recentStorageKey = authUser ? `@blinkr/recent-searches/${authUser.id}` : null;
  const visibleTabs = booksTrending ? tabs.filter((item) => item.key === 'books') : mediaOnly ? tabs.filter((item) => item.key === 'movies' || item.key === 'tv') : tabs;

  useEffect(() => {
    let active = true;
    if (!recentStorageKey) { setRecent([]); return; }
    AsyncStorage.getItem(recentStorageKey).then((stored) => {
      if (!active || !stored) return;
      try { const parsed = JSON.parse(stored); if (Array.isArray(parsed)) setRecent(parsed.filter((item): item is string => typeof item === 'string').slice(0, 8)); } catch { setRecent([]); }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [recentStorageKey]);

  const persistRecentSearches = (next: string[]) => {
    setRecent(next);
    if (recentStorageKey) void AsyncStorage.setItem(recentStorageKey, JSON.stringify(next));
  };
  const commitSearch = (value: string) => {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized || normalized.length < 2) return;
    persistRecentSearches([normalized, ...recentSearchesRef.current.filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 8));
  };
  const removeRecentSearch = (value: string) => persistRecentSearches(recentSearchesRef.current.filter((item) => item !== value));
  const clearRecentSearches = () => persistRecentSearches([]);
  const updateQuery = (value: string) => { setQuery(value); setBookPage(1); setComicPage(1); setBookResults([]); setComicResults([]); };

  useEffect(() => {
    setTab(booksTrending ? 'books' : mediaOnly ? 'movies' : 'all');
    setQuery('');
    setDebouncedQuery('');
    setSearchFocused(false);
  }, [mediaOnly]);

  useEffect(() => {
    if (!shouldSearch) return;
    const timer = setTimeout(() => commitSearch(trimmed), 700);
    return () => clearTimeout(timer);
  }, [trimmed, shouldSearch]);

  useEffect(() => {
    if (!shouldSearch || !booksQuery.data || booksQuery.data.page !== bookPage) return;
    const next = booksQuery.data.results;
    setBookResults((current) => bookPage === 1 ? next : [...current, ...next.filter((book) => !current.some((item) => item.workId === book.workId))]);
  }, [booksQuery.data, bookPage, shouldSearch]);

  useEffect(() => {
    if (!comicsQuery.data || comicsQuery.data.page !== comicPage) return;
    setComicResults((current) => comicPage === 1 ? comicsQuery.data.results : [...current, ...comicsQuery.data.results.filter((comic) => !current.some((item) => item.id === comic.id))]);
  }, [comicsQuery.data, comicPage]);

  useEffect(() => {
    let active = true;
    if (!shouldSearch || tab === 'people' || tab === 'reviews' || tab === 'books') {
      setMediaResults([]);
      setMediaLoading(false);
      return () => { active = false; };
    }
    setMediaLoading(true);
    setMediaError(null);
    setMediaResults([]);
    searchMulti(debouncedQuery, 1)
      .then((data) => { if (active) setMediaResults(data.results.filter((item) => item.mediaType === 'movie' || item.mediaType === 'tv')); })
      .catch((error) => { if (active) setMediaError(error instanceof Error ? error.message : 'تعذر البحث عن العناوين الآن.'); })
      .finally(() => { if (active) setMediaLoading(false); });
    return () => { active = false; };
  }, [debouncedQuery, tab, shouldSearch, mediaRetry]);

  const media = mediaResults.filter((item) => {
    if (tab === 'all') return true;
    if (tab === 'movies') return item.mediaType === 'movie';
    if (tab === 'tv') return item.mediaType === 'tv';
    return false;
  });
  const people = peopleQuery.data ?? [];
  const reviews = reviewsQuery.data ?? [];
  const books = booksTrending ? ((trendingBooksQuery.data ?? []) as BookSummary[]).filter((book) => Boolean(book.coverUrl)) : bookResults.filter((book) => Boolean(book.coverUrl));
  const comics = comicResults;
  const isLoading = booksTrending ? trendingBooksQuery.isLoading : tab === 'all'
    ? mediaLoading || (booksQuery.isLoading && books.length === 0) || comicsQuery.isLoading || (Boolean(authUser) && (peopleQuery.isLoading || reviewsQuery.isLoading))
    : tab === 'people' ? peopleQuery.isLoading
      : tab === 'reviews' ? reviewsQuery.isLoading
        : tab === 'books' ? booksQuery.isLoading && books.length === 0
          : tab === 'comics' ? comicsQuery.isLoading
          : mediaLoading;
  const hasError = booksTrending ? trendingBooksQuery.error : tab === 'people' ? peopleQuery.error
    : tab === 'reviews' ? reviewsQuery.error
      : tab === 'books' ? booksQuery.error
        : tab === 'comics' ? comicsQuery.error
        : tab === 'movies' || tab === 'tv' ? mediaError
          : null;
  const allHasError = Boolean(mediaError || booksQuery.error || trendingBooksQuery.error || comicsQuery.error || (authUser && (peopleQuery.error || reviewsQuery.error)));
  const hasAnySearchResults = media.length > 0 || people.length > 0 || reviews.length > 0 || books.length > 0 || comics.length > 0;
  const fatalSearchError = tab === 'all' ? allHasError && !hasAnySearchResults : Boolean(hasError) && (tab !== 'books' || books.length === 0) && (tab !== 'comics' || comics.length === 0);
  const retrySearch = () => {
    if (booksTrending) { void trendingBooksQuery.refetch(); return; }
    if (tab === 'people') { void peopleQuery.refetch(); return; }
    if (tab === 'reviews') { void reviewsQuery.refetch(); return; }
    if (tab === 'books') { void booksQuery.refetch(); return; }
    if (tab === 'comics') { void comicsQuery.refetch(); return; }
    if (tab === 'all') {
      if (authUser) { void peopleQuery.refetch(); void reviewsQuery.refetch(); }
      void booksQuery.refetch(); void comicsQuery.refetch();
    }
    setMediaRetry((attempt) => attempt + 1);
  };
  const showNoResults = !isLoading && !fatalSearchError && !(tab === 'all' && allHasError) && (tab === 'all'
    ? people.length === 0 && media.length === 0 && books.length === 0 && comics.length === 0 && reviews.length === 0
    : tab === 'people' ? people.length === 0
      : tab === 'reviews' ? reviews.length === 0
        : tab === 'books' ? books.length === 0
          : tab === 'comics' ? comics.length === 0
          : media.length === 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.header}>{booksTrending ? 'الكتب الرائجة عالميًا' : mediaOnly ? 'الأفلام والمسلسلات' : 'بحث'}</Text>
      {!booksTrending ? <View style={styles.searchBar}><Ionicons name="search" size={19} color={colors.textFaint} /><TextInput style={styles.input} placeholder={mediaOnly ? 'ابحث عن فيلم أو مسلسل…' : 'ابحث عن أشخاص أو مراجعات أو أفلام أو مسلسلات أو كتب…'} placeholderTextColor={colors.textFaint} value={query} onChangeText={updateQuery} onFocus={() => setSearchFocused(true)} onSubmitEditing={() => { commitSearch(query); setTab(mediaOnly ? 'movies' : 'all'); }} returnKeyType="search" autoCorrect={false} selectionColor={colors.accent} cursorColor={colors.accent} />{query ? <Pressable onPress={() => updateQuery('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.textFaint} /></Pressable> : null}</View> : null}
      {searchFocused && !trimmed && recentSearches.length > 0 ? <View style={styles.recentPanel}><View style={styles.recentHeader}><Text style={styles.recentTitle}>عمليات البحث الأخيرة</Text><Pressable onPress={clearRecentSearches}><Text style={styles.clearRecent}>مسح الكل</Text></Pressable></View>{recentSearches.map((item) => <View key={item} style={styles.recentRow}><Pressable style={styles.recentSelect} onPress={() => { updateQuery(item); setTab(mediaOnly ? 'movies' : 'all'); commitSearch(item); }}><Ionicons name="time-outline" size={16} color={colors.textFaint} /><Text style={styles.recentText} numberOfLines={1}>{item}</Text></Pressable><Pressable onPress={() => removeRecentSearch(item)} hitSlop={8} accessibilityLabel={`حذف ${item} من عمليات البحث الأخيرة`}><Ionicons name="close" size={16} color={colors.textFaint} /></Pressable></View>)}</View> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {visibleTabs.map((item) => <Pressable key={item.key} onPress={() => setTab(item.key)} style={[styles.tab, tab === item.key && styles.tabActive]}><Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text></Pressable>)}
      </ScrollView>
      {!shouldSearch && !booksTrending ? <EmptyState icon="search-outline" title={mediaOnly ? 'ابحث عن فيلم أو مسلسل' : 'ابحث في Blinkr'} message={mediaOnly ? 'اكتب اسم الفيلم أو المسلسل الذي تريد إضافته إلى مفضلاتك.' : 'اعثر على الأشخاص والمراجعات والأفلام والمسلسلات والكتب.'} /> : isLoading ? <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /><Text style={styles.loadingText}>{booksTrending ? 'جارٍ تحميل الكتب الرائجة…' : 'جارٍ البحث…'}</Text></View> : fatalSearchError ? <ApiErrorState message="تعذر إكمال تحميل الكتب الآن. تحقق من الاتصال ثم أعد المحاولة." onRetry={retrySearch} /> : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {tab === 'all' && allHasError ? <View style={styles.partialError}><Text style={styles.partialErrorText}>تعذر تحميل بعض النتائج. يمكنك مراجعة النتائج المتاحة أو إعادة المحاولة.</Text><Pressable onPress={retrySearch} accessibilityRole="button"><Text style={styles.partialRetry}>إعادة المحاولة</Text></Pressable></View> : null}
          {(tab === 'all' || tab === 'people') && people.length > 0 ? <Section title="الأشخاص" action={() => setTab('people')}><View>{people.slice(0, tab === 'people' ? 50 : 5).map((person: any) => <Pressable key={person.id} style={styles.personRow} onPress={() => navigation.navigate('UserProfile', { userId: String(person.id) })}><UserAvatar name={person.name || person.username} color={colors.accent} size={42} /><View style={styles.resultCopy}><Text style={styles.resultTitle}>{person.name || person.username}</Text><Text style={styles.resultMeta}>@{person.username}</Text>{person.bio ? <Text style={styles.resultSub} numberOfLines={1}>{person.bio}</Text> : null}</View><Ionicons name="chevron-forward" size={18} color={colors.textFaint} /></Pressable>)}</View></Section> : null}
          {(tab === 'all' || tab === 'movies' || tab === 'tv') && media.length > 0 ? <Section title={tab === 'all' ? 'الأفلام والمسلسلات' : tab === 'movies' ? 'الأفلام' : 'المسلسلات'} action={() => setTab(tab === 'tv' ? 'tv' : 'movies')}><View style={styles.mediaGrid}>{media.slice(0, tab === 'all' ? 6 : 30).map((item) => <PosterCard key={`${item.mediaType}-${item.id}`} item={item} width={108} onPress={() => navigation.navigate('Detail', { mediaType: item.mediaType, id: item.id })} />)}</View></Section> : null}
          {(tab === 'all' || tab === 'books') && books.length > 0 ? <Section title={booksTrending ? 'الكتب الرائجة عالميًا' : 'الكتب'} action={() => setTab('books')}><View style={styles.mediaGrid}>{(tab === 'all' ? books.slice(0, 6) : books).map((book) => <BookCard key={book.workId} book={book} width={108} onPress={() => navigation.navigate('BookDetail', { workId: book.workId, book })} />)}</View></Section> : null}
          {(tab === 'all' || tab === 'comics') && comics.length > 0 ? <Section title="الكوميك" action={() => setTab('comics')}><View style={styles.mediaGrid}>{comics.slice(0, tab === 'all' ? 6 : 20).map((comic) => <ComicCard key={comic.id} comic={comic} width={108} onPress={() => navigation.navigate('ComicDetail', { id: comic.id, comic })} />)}</View></Section> : null}
          {tab === 'books' && booksQuery.data && bookPage < booksQuery.data.totalPages ? <Pressable disabled={booksQuery.isFetching} style={styles.loadMore} onPress={() => setBookPage((page) => page + 1)}>{booksQuery.isFetching ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.loadMoreText}>عرض المزيد من الكتب</Text>}</Pressable> : null}
          {tab === 'comics' && comicsQuery.data && comicPage < comicsQuery.data.totalPages ? <Pressable disabled={comicsQuery.isFetching} style={styles.loadMore} onPress={() => setComicPage((page) => page + 1)}>{comicsQuery.isFetching ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.loadMoreText}>عرض المزيد من الكوميك</Text>}</Pressable> : null}
          {tab === 'books' && booksQuery.isFetching && !booksQuery.data && books.length > 0 ? <ActivityIndicator color={colors.accent} /> : null}
          {tab === 'books' && booksQuery.isError && books.length > 0 ? <Pressable onPress={() => void booksQuery.refetch()} accessibilityRole="button"><Text style={styles.inlineError}>تعذر تحميل المزيد من الكتب — اضغط لإعادة المحاولة.</Text></Pressable> : null}
          {(tab === 'all' || tab === 'reviews') && reviews.length > 0 ? <Section title="المراجعات" action={() => setTab('reviews')}><View>{reviews.slice(0, tab === 'all' ? 5 : 50).map((row: any) => <Pressable key={row.review.id} style={styles.reviewRow} onPress={() => openCatalogItem(navigation, { mediaType: (row.review.mediaType === 'book' ? 'book' : row.review.mediaType === 'tv' ? 'tv' : 'movie') as ReviewMediaType, mediaId: row.review.mediaId, title: row.review.title, posterPath: row.review.posterPath })}><UserAvatar name={row.displayName || row.username} color={colors.accent} size={38} /><View style={styles.resultCopy}><Text style={styles.reviewAuthor}>{row.displayName || row.username} <Text style={styles.reviewMuted}>قيّم</Text></Text><Text style={styles.resultTitle} numberOfLines={1}>{row.review.title}</Text><Text style={styles.reviewText} numberOfLines={2}>{row.review.review}</Text><Text style={styles.rating}>★ {row.review.rating.toFixed(1)}</Text></View></Pressable>)}</View></Section> : null}
          {tab === 'all' && mediaError ? <Pressable onPress={() => setMediaRetry((attempt) => attempt + 1)} accessibilityRole="button"><Text style={styles.inlineError}>تعذر تحميل نتائج الأفلام والمسلسلات — اضغط لإعادة المحاولة.</Text></Pressable> : null}
          {tab === 'all' && booksQuery.error ? <Pressable onPress={() => void booksQuery.refetch()} accessibilityRole="button"><Text style={styles.inlineError}>تعذر تحميل نتائج الكتب — اضغط لإعادة المحاولة.</Text></Pressable> : null}
          {tab === 'all' && comicsQuery.error ? <Pressable onPress={() => void comicsQuery.refetch()} accessibilityRole="button"><Text style={styles.inlineError}>تعذر تحميل نتائج الكوميك — اضغط لإعادة المحاولة.</Text></Pressable> : null}
          {tab === 'all' && authUser && peopleQuery.error ? <Pressable onPress={() => void peopleQuery.refetch()} accessibilityRole="button"><Text style={styles.inlineError}>تعذر تحميل الأشخاص — اضغط لإعادة المحاولة.</Text></Pressable> : null}
          {tab === 'all' && authUser && reviewsQuery.error ? <Pressable onPress={() => void reviewsQuery.refetch()} accessibilityRole="button"><Text style={styles.inlineError}>تعذر تحميل المراجعات — اضغط لإعادة المحاولة.</Text></Pressable> : null}
          {showNoResults ? <EmptyState icon="search-outline" title="لا توجد نتائج" message="جرّب اسمًا أو عنوانًا أو مؤلفًا أو عبارة مراجعة مختلفة." /> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Section({ title, action, children }: { title: string; action: () => void; children: React.ReactNode }) { return <View style={styles.section}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text><Pressable onPress={action}><Text style={styles.seeAll}>عرض الكل</Text></Pressable></View>{children}</View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg }, header: { color: colors.text, fontSize: fontSizes.xxl, fontWeight: '900', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 48, borderWidth: 1, borderColor: colors.border }, input: { flex: 1, color: colors.text, fontSize: fontSizes.md }, recentPanel: { marginHorizontal: spacing.lg, marginTop: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing.xs }, recentTitle: { color: colors.text, fontSize: 13, fontWeight: '900' }, clearRecent: { color: colors.accent, fontSize: 12, fontWeight: '800' }, recentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 38, borderTopWidth: 1, borderTopColor: colors.border }, recentSelect: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8 }, recentText: { flex: 1, color: colors.textDim, fontSize: 13 },
  tabs: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }, tab: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, tabActive: { backgroundColor: colors.accent, borderColor: colors.accent }, tabText: { color: colors.textDim, fontSize: 12, fontWeight: '800' }, tabTextActive: { color: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 36 }, partialError: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border }, partialErrorText: { color: colors.textDim, fontSize: 12, flex: 1 }, partialRetry: { color: colors.accent, fontSize: 12, fontWeight: '800', paddingHorizontal: spacing.sm }, section: { marginBottom: spacing.lg }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }, sectionTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '900' }, seeAll: { color: colors.accent, fontSize: 12, fontWeight: '800' }, personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }, resultCopy: { flex: 1, minWidth: 0 }, resultTitle: { color: colors.text, fontSize: 14, fontWeight: '800' }, resultMeta: { color: colors.textDim, fontSize: 12, marginTop: 3 }, resultSub: { color: colors.textFaint, fontSize: 11, marginTop: 3 }, mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, reviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }, reviewAuthor: { color: colors.text, fontSize: 13, fontWeight: '800' }, reviewMuted: { color: colors.textDim, fontWeight: '500' }, reviewText: { color: colors.textDim, fontSize: 12, lineHeight: 18, marginTop: 3 }, rating: { color: colors.gold, fontSize: 12, fontWeight: '800', marginTop: 3 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, loadingText: { color: colors.textDim, fontSize: 12 }, inlineError: { color: colors.textFaint, fontSize: 12, paddingVertical: spacing.sm }, loadMore: { minHeight: 42, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md }, loadMoreText: { color: colors.accent, fontSize: 13, fontWeight: '800' },
});

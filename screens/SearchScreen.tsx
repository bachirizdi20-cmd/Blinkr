import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, Pressable, ActivityIndicator, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PosterCard from '../components/PosterCard';
import EmptyState from '../components/EmptyState';
import ApiErrorState from '../components/ApiErrorState';
import { ContentStackParamList } from '../navigation/types';
import { fetchDiscover, fetchGenres, searchMulti } from '../lib/tmdb';
import { NormalizedItem, Genre } from '../types/tmdb';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type Filter = 'all' | 'movie' | 'tv' | 'anime';

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GUTTER = spacing.md;
const CARD_WIDTH = (width - spacing.lg * 2 - GUTTER * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export default function SearchScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [results, setResults] = useState<NormalizedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [genreId, setGenreId] = useState<number | undefined>();
  const [year, setYear] = useState('');
  const [minRating, setMinRating] = useState('');
  const [maxRating, setMaxRating] = useState('');
  const [advancedError, setAdvancedError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await searchMulti(q, 1);
      setResults(data.results);
    } catch (err) {
      console.warn(err);
      setError(err instanceof Error ? err.message : 'Unable to reach TMDB right now.');
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, []);

  useEffect(() => {
    if (advancedOpen && genres.length === 0) {
      fetchGenres('movie').then(setGenres).catch(() => setAdvancedError('Unable to load genres.'));
    }
  }, [advancedOpen, genres.length]);

  useEffect(() => {
    if (advancedOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch, advancedOpen]);

  const applyAdvanced = async () => {
    setAdvancedError(null);
    const parsedYear = year.trim() ? Number(year) : undefined;
    const parsedMin = minRating.trim() ? Number(minRating) : undefined;
    const parsedMax = maxRating.trim() ? Number(maxRating) : undefined;
    if (parsedYear !== undefined && (!Number.isInteger(parsedYear) || parsedYear < 1888 || parsedYear > new Date().getFullYear() + 2)) {
      setAdvancedError('Enter a valid release year.');
      return;
    }
    if (parsedMin !== undefined && (parsedMin < 0 || parsedMin > 10) || parsedMax !== undefined && (parsedMax < 0 || parsedMax > 10)) {
      setAdvancedError('Ratings must be between 0 and 10.');
      return;
    }
    if (parsedMin !== undefined && parsedMax !== undefined && parsedMin > parsedMax) {
      setAdvancedError('Minimum rating cannot exceed maximum rating.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const media = filter === 'tv' ? 'tv' : 'movie';
      const data = await fetchDiscover(media, { genreId, year: parsedYear, minRating: parsedMin, maxRating: parsedMax });
      setResults(data.results);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to apply filters right now.');
    } finally {
      setLoading(false);
    }
  };

  const resetAdvanced = () => {
    setGenreId(undefined);
    setYear('');
    setMinRating('');
    setMaxRating('');
    setAdvancedError(null);
    setResults([]);
    setSearched(false);
  };

  const filtered = results.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'anime') return r.isAnime;
    return r.mediaType === filter;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.header}>Search</Text>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput style={styles.input} placeholder="Search movies, shows, anime..." placeholderTextColor={colors.textFaint} value={query} onChangeText={(value) => { setQuery(value); setAdvancedOpen(false); }} returnKeyType="search" autoCorrect={false} />
        {query.length > 0 && <Pressable onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.textFaint} /></Pressable>}
      </View>

      <View style={styles.filterRow}>
        {(['all', 'movie', 'tv', 'anime'] as Filter[]).map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filterPill, filter === f && styles.filterPillActive]}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f === 'all' ? 'All' : f === 'movie' ? 'Movies' : f === 'tv' ? 'TV' : 'Anime'}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setAdvancedOpen((value) => !value)} style={[styles.filterPill, advancedOpen && styles.filterPillActive]}>
          <Ionicons name="options-outline" size={15} color={advancedOpen ? '#04120C' : colors.textDim} />
          <Text style={[styles.filterText, advancedOpen && styles.filterTextActive]}>Filters</Text>
        </Pressable>
      </View>

      {advancedOpen ? (
        <View style={styles.advancedPanel}>
          <Text style={styles.panelTitle}>Discover filters</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genreRow}>
            <Pressable onPress={() => setGenreId(undefined)} style={[styles.genrePill, genreId === undefined && styles.genreActive]}><Text style={[styles.genreText, genreId === undefined && styles.filterTextActive]}>Any genre</Text></Pressable>
            {genres.map((genre) => <Pressable key={genre.id} onPress={() => setGenreId(genre.id)} style={[styles.genrePill, genreId === genre.id && styles.genreActive]}><Text style={[styles.genreText, genreId === genre.id && styles.filterTextActive]}>{genre.name}</Text></Pressable>)}
          </ScrollView>
          <View style={styles.fieldRow}>
            <TextInput style={styles.smallInput} placeholder="Year" placeholderTextColor={colors.textFaint} value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} />
            <TextInput style={styles.smallInput} placeholder="Min rating" placeholderTextColor={colors.textFaint} value={minRating} onChangeText={setMinRating} keyboardType="decimal-pad" maxLength={4} />
            <TextInput style={styles.smallInput} placeholder="Max rating" placeholderTextColor={colors.textFaint} value={maxRating} onChangeText={setMaxRating} keyboardType="decimal-pad" maxLength={4} />
          </View>
          {advancedError ? <Text style={styles.advancedError}>{advancedError}</Text> : null}
          <View style={styles.actionRow}>
            <Pressable onPress={resetAdvanced} style={styles.resetButton}><Text style={styles.resetText}>Reset</Text></Pressable>
            <Pressable onPress={applyAdvanced} style={styles.applyButton}><Text style={styles.applyText}>Apply filters</Text></Pressable>
          </View>
        </View>
      ) : null}

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View> : error ? <ApiErrorState message={error} onRetry={() => advancedOpen ? applyAdvanced() : runSearch(query)} /> : !searched ? <EmptyState icon="search-outline" title="Find something to watch" message="Search across movies, TV shows, and anime powered by TMDB." /> : filtered.length === 0 ? <EmptyState icon="sad-outline" title="No matches" message="Try changing your search or filters." /> : (
        <FlatList data={filtered} keyExtractor={(item) => `${item.mediaType}-${item.id}`} numColumns={NUM_COLUMNS} contentContainerStyle={styles.grid} columnWrapperStyle={{ gap: GUTTER }} keyboardShouldPersistTaps="handled" ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />} renderItem={({ item }) => <PosterCard item={item} width={CARD_WIDTH} onPress={() => navigation.navigate('Detail', { mediaType: item.mediaType, id: item.id })} />} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { color: colors.text, fontSize: fontSizes.xxl, fontWeight: '800', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 46, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, color: colors.text, fontSize: fontSizes.md },
  filterRow: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm, flexWrap: 'wrap' },
  filterPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterPillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: '#04120C' },
  advancedPanel: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  panelTitle: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '800', marginBottom: spacing.sm },
  genreRow: { gap: spacing.xs, paddingBottom: spacing.sm },
  genrePill: { paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  genreActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  genreText: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  fieldRow: { flexDirection: 'row', gap: spacing.sm },
  smallInput: { flex: 1, minWidth: 0, color: colors.text, backgroundColor: colors.bg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 10, fontSize: 12 },
  advancedError: { color: colors.danger, fontSize: 12, marginTop: spacing.sm },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  resetButton: { paddingHorizontal: spacing.md, paddingVertical: 10 },
  resetText: { color: colors.textDim, fontWeight: '800' },
  applyButton: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 10 },
  applyText: { color: colors.bg, fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { padding: spacing.lg },
});

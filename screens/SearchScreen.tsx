import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PosterCard from '../components/PosterCard';
import EmptyState from '../components/EmptyState';
import ApiErrorState from '../components/ApiErrorState';
import { ContentStackParamList } from '../navigation/types';
import { searchMulti } from '../lib/tmdb';
import { NormalizedItem } from '../types/tmdb';
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
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

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
        <TextInput
          style={styles.input}
          placeholder="Search movies, shows, anime..."
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </Pressable>
        )}
      </View>

      <View style={styles.filterRow}>
        {(['all', 'movie', 'tv', 'anime'] as Filter[]).map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filterPill, filter === f && styles.filterPillActive]}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f === 'movie' ? 'Movies' : f === 'tv' ? 'TV' : 'Anime'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : error ? (
        <ApiErrorState message={error} onRetry={() => runSearch(query)} />
      ) : !searched ? (
        <EmptyState icon="search-outline" title="Find something to watch" message="Search across movies, TV shows, and anime powered by TMDB." />
      ) : filtered.length === 0 ? (
        <EmptyState icon="sad-outline" title="No matches" message={`Nothing found for "${query}"`} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => `${item.mediaType}-${item.id}`}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: GUTTER }}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
          renderItem={({ item }) => (
            <PosterCard
              item={item}
              width={CARD_WIDTH}
              onPress={() => navigation.navigate('Detail', { mediaType: item.mediaType, id: item.id })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { color: colors.text, fontSize: fontSizes.xxl, fontWeight: '800', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, color: colors.text, fontSize: fontSizes.md },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm },
  filterPill: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterPillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '700' },
  filterTextActive: { color: '#04120C' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { padding: spacing.lg },
});

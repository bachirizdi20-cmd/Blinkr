import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PosterCard from '../components/PosterCard';
import EmptyState from '../components/EmptyState';
import { ContentStackParamList } from '../navigation/types';
import { useLibrary } from '../context/LibraryContext';
import { colors, fontSizes, spacing } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type Filter = 'all' | 'movie' | 'tv';

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GUTTER = spacing.md;
const CARD_WIDTH = (width - spacing.lg * 2 - GUTTER * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export default function WatchlistScreen() {
  const navigation = useNavigation<Nav>();
  const lib = useLibrary();
  const [filter, setFilter] = useState<Filter>('all');

  const items = Object.values(lib.watchlist)
    .filter((i) => filter === 'all' || i.mediaType === filter)
    .sort((a, b) => b.addedAt - a.addedAt);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Watchlist</Text>
        <Text style={styles.count}>{Object.values(lib.watchlist).length}</Text>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'movie', 'tv'] as Filter[]).map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} style={[styles.pill, filter === f && styles.pillActive]}>
            <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>
              {f === 'all' ? 'All' : f === 'movie' ? 'Movies' : 'TV'}
            </Text>
          </Pressable>
        ))}
      </View>

      {items.length === 0 ? (
        <EmptyState icon="bookmark-outline" title="Your watchlist is empty" message="Save movies, shows, and anime you want to watch later." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.mediaType}-${item.mediaId}`}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: GUTTER }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
          renderItem={({ item }) => (
            <View>
              <PosterCard
                item={{ id: item.mediaId, mediaType: item.mediaType, title: item.title, posterPath: item.posterPath, date: item.date, voteAverage: item.voteAverage }}
                width={CARD_WIDTH}
                onPress={() => navigation.navigate('Detail', { mediaType: item.mediaType, id: item.mediaId })}
              />
              <Pressable
                style={styles.removeBtn}
                onPress={() => lib.toggleWatchlist({ mediaType: item.mediaType, mediaId: item.mediaId, title: item.title, posterPath: item.posterPath })}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  header: { color: colors.text, fontSize: fontSizes.xxl, fontWeight: '800' },
  count: { color: colors.textFaint, fontSize: fontSizes.md, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '700' },
  pillTextActive: { color: '#04120C' },
  grid: { padding: spacing.lg },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
});

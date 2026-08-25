import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PosterCard from '../components/PosterCard';
import EmptyState from '../components/EmptyState';
import { ContentStackParamList } from '../navigation/types';
import { fetchFeedPage } from '../lib/tmdb';
import { NormalizedItem } from '../types/tmdb';
import { colors, spacing } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type RouteT = RouteProp<ContentStackParamList, 'CategoryList'>;

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GUTTER = spacing.md;
const CARD_WIDTH = (width - spacing.lg * 2 - GUTTER * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export default function CategoryListScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { feed } = route.params;

  const [items, setItems] = useState<NormalizedItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadPage = useCallback(
    async (pageToLoad: number, replace: boolean) => {
      try {
        const data = await fetchFeedPage(feed, pageToLoad);
        setTotalPages(data.totalPages);
        setItems((prev) => (replace ? data.results : [...prev, ...data.results]));
        setPage(data.page);
      } catch (err) {
        console.warn(err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [feed]
  );

  useEffect(() => {
    setLoading(true);
    loadPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnd = () => {
    if (loadingMore || loading || page >= totalPages) return;
    setLoadingMore(true);
    loadPage(page + 1, false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState icon="film-outline" title="No results" message="Nothing to show here yet." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.mediaType}-${item.id}`}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: GUTTER }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
          renderItem={({ item }) => (
            <PosterCard
              item={item}
              width={CARD_WIDTH}
              onPress={() => navigation.navigate('Detail', { mediaType: item.mediaType, id: item.id })}
            />
          )}
          onEndReachedThreshold={0.5}
          onEndReached={handleEnd}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: spacing.lg }} color={colors.accent} /> : null}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { padding: spacing.lg },
});

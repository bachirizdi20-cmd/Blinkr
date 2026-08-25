import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import EmptyState from '../components/EmptyState';
import ApiErrorState from '../components/ApiErrorState';
import { ContentStackParamList } from '../navigation/types';
import { fetchReviews, profileUrl } from '../lib/tmdb';
import { TMDBReview } from '../types/tmdb';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type RouteT = RouteProp<ContentStackParamList, 'AllReviews'>;
type SortKey = 'date' | 'rating';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'TMDB review' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AllReviewsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { mediaType, id, title } = route.params;
  const [reviews, setReviews] = useState<TMDBReview[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [sort, setSort] = useState<SortKey>('date');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchReviews(mediaType, id, page);
      setReviews(result.results);
      setTotalPages(result.totalPages);
      setTotalResults(result.totalResults);
    } catch (err) {
      console.warn(err);
      setError(err instanceof Error ? err.message : 'Unable to load reviews right now.');
    } finally {
      setLoading(false);
    }
  }, [mediaType, id, page]);

  useEffect(() => {
    load();
  }, [load]);

  const sortedReviews = useMemo(() => {
    return [...reviews].sort((a, b) => {
      if (sort === 'rating') return (b.rating ?? -1) - (a.rating ?? -1);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [reviews, sort]);

  const changeSort = (next: SortKey) => {
    setSort(next);
    setPage(1);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title} numberOfLines={1}>All Reviews</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{title}</Text>
        </View>
        <View style={styles.countPill}><Text style={styles.countText}>{totalResults || '—'}</Text></View>
      </View>

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort by</Text>
        <Pressable style={[styles.sortPill, sort === 'date' && styles.sortPillActive]} onPress={() => changeSort('date')}>
          <Ionicons name="calendar-outline" size={15} color={sort === 'date' ? colors.bg : colors.textDim} />
          <Text style={[styles.sortText, sort === 'date' && styles.sortTextActive]}>Newest</Text>
        </Pressable>
        <Pressable style={[styles.sortPill, sort === 'rating' && styles.sortPillActive]} onPress={() => changeSort('rating')}>
          <Ionicons name="star-outline" size={15} color={sort === 'rating' ? colors.bg : colors.textDim} />
          <Text style={[styles.sortText, sort === 'rating' && styles.sortTextActive]}>Highest rated</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : error ? (
        <ApiErrorState message={error} onRetry={load} />
      ) : sortedReviews.length === 0 ? (
        <EmptyState icon="chatbox-ellipses-outline" title="No reviews found" message="TMDB has not published reviews for this title yet." />
      ) : (
        <FlatList
          data={sortedReviews}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <ReviewCard review={item} />}
          ListFooterComponent={
            <View style={styles.pagination}>
              <Pressable
                style={[styles.pageButton, page <= 1 && styles.pageButtonDisabled]}
                disabled={page <= 1}
                onPress={() => setPage((current) => Math.max(1, current - 1))}
              >
                <Ionicons name="chevron-back" size={16} color={page <= 1 ? colors.textFaint : colors.text} />
                <Text style={[styles.pageButtonText, page <= 1 && styles.pageButtonTextDisabled]}>Previous</Text>
              </Pressable>
              <Text style={styles.pageIndicator}>Page {page} of {totalPages}</Text>
              <Pressable
                style={[styles.pageButton, page >= totalPages && styles.pageButtonDisabled]}
                disabled={page >= totalPages}
                onPress={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                <Text style={[styles.pageButtonText, page >= totalPages && styles.pageButtonTextDisabled]}>Next</Text>
                <Ionicons name="chevron-forward" size={16} color={page >= totalPages ? colors.textFaint : colors.text} />
              </Pressable>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function ReviewCard({ review }: { review: TMDBReview }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => review.url && Linking.openURL(review.url)}
      accessibilityRole="button"
      accessibilityLabel={`Read review by ${review.author}`}
    >
      <View style={styles.cardHeader}>
        {review.authorAvatarPath ? (
          <Image source={{ uri: profileUrl(review.authorAvatarPath) ?? undefined }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}><Ionicons name="person" size={19} color={colors.textFaint} /></View>
        )}
        <View style={styles.authorBlock}>
          <Text style={styles.author} numberOfLines={1}>{review.author}</Text>
          {!!review.authorUsername && <Text style={styles.username} numberOfLines={1}>@{review.authorUsername}</Text>}
        </View>
        {review.rating !== null && (
          <View style={styles.rating}><Ionicons name="star" size={14} color={colors.gold} /><Text style={styles.ratingText}>{review.rating}/10</Text></View>
        )}
      </View>
      <Text style={styles.body}>{review.content.trim()}</Text>
      <View style={styles.footer}><Text style={styles.date}>{formatDate(review.createdAt)}</Text><Text style={styles.external}>Read on TMDB</Text></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.sm },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  headerCopy: { flex: 1 },
  title: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '800' },
  subtitle: { color: colors.textDim, fontSize: fontSizes.xs, marginTop: 2 },
  countPill: { backgroundColor: colors.surfaceHigh, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  countText: { color: colors.accent, fontSize: fontSizes.xs, fontWeight: '800' },
  sortRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
  sortLabel: { color: colors.textFaint, fontSize: fontSizes.xs, fontWeight: '700', marginRight: 2 },
  sortPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sortPillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  sortText: { color: colors.textDim, fontSize: fontSizes.xs, fontWeight: '700' },
  sortTextActive: { color: colors.bg },
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  cardPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceHigh },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  authorBlock: { flex: 1 },
  author: { color: colors.text, fontSize: fontSizes.md, fontWeight: '800' },
  username: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: colors.gold, fontSize: fontSizes.sm, fontWeight: '800' },
  body: { color: colors.textDim, fontSize: fontSizes.sm, lineHeight: 21, marginTop: spacing.md },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  date: { color: colors.textFaint, fontSize: 11 },
  external: { color: colors.accent, fontSize: 11, fontWeight: '800' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xl, gap: spacing.sm },
  pageButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pageButtonDisabled: { opacity: 0.45 },
  pageButtonText: { color: colors.text, fontSize: fontSizes.xs, fontWeight: '700' },
  pageButtonTextDisabled: { color: colors.textFaint },
  pageIndicator: { color: colors.textDim, fontSize: fontSizes.xs, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import { catalogPosterUrl } from '../lib/catalog-navigation';
import { ReviewMediaType } from '../types/tmdb';

export type ProfileTopReviewItem = {
  id: string | number;
  title: string;
  posterPath?: string | null;
  rating: number;
  mediaType: ReviewMediaType;
  mediaId: number;
};

export function ProfileTopReviews({
  items,
  loading,
  error,
  onRetry,
  onOpen,
  subtitle = 'أبرز اختياراته من المراجعات المنشورة',
}: {
  items: ProfileTopReviewItem[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onOpen: (mediaType: ReviewMediaType, mediaId: number) => void;
  subtitle?: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>الأعلى تقييمًا</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Ionicons name="sparkles-outline" size={21} color={colors.gold} />
      </View>
      {loading ? (
        <View style={styles.state}><ActivityIndicator color={colors.accent} /><Text style={styles.stateText}>جارٍ تحميل الاختيارات…</Text></View>
      ) : error ? (
        <View style={[styles.state, styles.empty]}><Text style={styles.stateText}>تعذر تحميل الاختيارات.</Text>{onRetry ? <Pressable onPress={onRetry}><Text style={styles.retry}>إعادة المحاولة</Text></Pressable> : null}</View>
      ) : items.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {items.map((item) => {
            const poster = catalogPosterUrl(item.mediaType, item.posterPath ?? null, 'w342');
            return (
              <Pressable key={item.id} style={styles.card} onPress={() => onOpen(item.mediaType, item.mediaId)} accessibilityRole="button">
                <View style={styles.posterWrap}>
                  {poster ? <Image source={{ uri: poster }} style={styles.poster} contentFit="cover" /> : <View style={[styles.poster, styles.posterFallback]}><Ionicons name={item.mediaType === 'book' ? 'book-outline' : 'film-outline'} size={26} color={colors.textFaint} /></View>}
                  <View style={styles.rating}><Ionicons name="star" size={11} color={colors.gold} /><Text style={styles.ratingText}>{item.rating}/10</Text></View>
                </View>
                <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <View style={[styles.state, styles.empty]}><Text style={styles.stateText}>ستظهر هنا أعلى التقييمات بعد نشر المراجعات.</Text></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '800', textAlign: 'right' },
  subtitle: { color: colors.textFaint, fontSize: fontSizes.xs, marginTop: 3, textAlign: 'right' },
  rail: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm },
  card: { width: 115, gap: spacing.xs },
  posterWrap: { width: 115, height: 172, position: 'relative', overflow: 'hidden', borderRadius: radius.md, backgroundColor: colors.surfaceHigh },
  poster: { width: '100%', height: '100%' },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  rating: { position: 'absolute', right: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.78)', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 4 },
  ratingText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  itemTitle: { color: colors.text, fontSize: fontSizes.xs, fontWeight: '700', textAlign: 'right' },
  state: { minHeight: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  stateText: { color: colors.textDim, fontSize: fontSizes.sm, textAlign: 'center' },
  empty: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, flexDirection: 'column' },
  retry: { color: colors.accent, fontSize: fontSizes.sm, fontWeight: '800' },
});

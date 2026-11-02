import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type ProfileStatsGridProps = {
  followers: number;
  following: number;
  reviews: number;
  averageRating: number | null;
  movieReviews: number;
  tvReviews: number;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
};

export function ProfileStatsGrid({
  followers,
  following,
  reviews,
  averageRating,
  movieReviews,
  tvReviews,
  onFollowersPress,
  onFollowingPress,
}: ProfileStatsGridProps) {
  const items = [
    { label: 'المتابعون', value: followers, onPress: onFollowersPress },
    { label: 'يتابع', value: following, onPress: onFollowingPress },
    { label: 'مراجعة منشورة', value: reviews },
    { label: 'متوسط التقييم / 10', value: averageRating == null ? '—' : averageRating.toFixed(1) },
    { label: 'مراجعة فيلم', value: movieReviews },
    { label: 'مراجعة مسلسل', value: tvReviews },
  ];

  return (
    <View style={styles.grid}>
      {items.map((item) => {
        const content = <><Text style={styles.value}>{item.value.toLocaleString('ar')}</Text><Text style={styles.label}>{item.label}</Text></>;
        return item.onPress ? (
          <Pressable key={item.label} style={styles.card} onPress={item.onPress} accessibilityRole="button">
            {content}
          </Pressable>
        ) : (
          <View key={item.label} style={styles.card}>{content}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.xl },
  card: { width: '48%', minHeight: 68, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  value: { color: colors.accent, fontSize: fontSizes.lg, fontWeight: '800' },
  label: { color: colors.textFaint, fontSize: 10, fontWeight: '700', marginTop: 3, textAlign: 'center' },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type ProfileStatsGridProps = {
  followers: number | null;
  following: number | null;
  reviews: number | null;
  followingLabel?: string;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  onReviewsPress?: () => void;
};

export function ProfileStatsGrid({
  followers,
  following,
  reviews,
  followingLabel = 'أتابعهم',
  onFollowersPress,
  onFollowingPress,
  onReviewsPress,
}: ProfileStatsGridProps) {
  const items = [
    { label: 'المتابعون', value: followers, onPress: onFollowersPress },
    { label: followingLabel, value: following, onPress: onFollowingPress },
    { label: 'المراجعات', value: reviews, onPress: onReviewsPress },
  ];

  return (
    <View style={styles.grid}>
      {items.map((item, index) => {
        const content = (
          <>
            <Text style={styles.value}>{item.value == null ? '—' : item.value.toLocaleString('ar')}</Text>
            <Text style={styles.label}>{item.label}</Text>
          </>
        );
        const cellStyle = [styles.item, index < items.length - 1 && styles.divided];
        const accessibilityLabel = `${item.value == null ? 'غير متاح' : item.value.toLocaleString('ar')} ${item.label}`;
        return item.onPress ? (
          <Pressable
            key={item.label}
            style={({ pressed }) => [...cellStyle, pressed && styles.pressed]}
            onPress={item.onPress}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
          >
            {content}
          </Pressable>
        ) : (
          <View key={item.label} style={cellStyle} accessibilityLabel={accessibilityLabel}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row-reverse',
    alignItems: 'stretch',
    marginTop: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  item: { flex: 1, minWidth: 0, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: spacing.xs },
  divided: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
  value: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '900', fontVariant: ['tabular-nums'] },
  label: { color: colors.textDim, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: 0.68 },
});

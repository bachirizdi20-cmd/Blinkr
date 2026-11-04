import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../lib/theme';

type ProfileStatsGridProps = {
  followers: number | null;
  following: number | null;
  reviews: number | null;
  followingLabel?: string;
  compact?: boolean;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  onReviewsPress?: () => void;
};

export function ProfileStatsGrid({
  followers,
  following,
  reviews,
  followingLabel = 'أتابعهم',
  compact = false,
  onFollowersPress,
  onFollowingPress,
  onReviewsPress,
}: ProfileStatsGridProps) {
  const items = [
    { label: 'المراجعات', value: reviews, onPress: onReviewsPress },
    { label: followingLabel, value: following, onPress: onFollowingPress },
    { label: 'المتابعون', value: followers, onPress: onFollowersPress },
  ];

  return (
    <View style={[styles.grid, compact && styles.gridCompact]}>
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
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  gridCompact: { marginTop: 0, marginBottom: 0 },
  item: { flex: 1, minWidth: 0, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 1, paddingHorizontal: spacing.xs },
  divided: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
  value: { color: colors.text, fontSize: 17, lineHeight: 21, fontWeight: '900', fontVariant: ['tabular-nums'] },
  label: { color: colors.textDim, fontSize: 10, lineHeight: 14, fontWeight: '600', textAlign: 'center' },
  pressed: { opacity: 0.68 },
});

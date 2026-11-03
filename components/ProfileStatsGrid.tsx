import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type ProfileStatsGridProps = {
  followers: number;
  following: number;
  followingLabel?: string;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
};

export function ProfileStatsGrid({
  followers,
  following,
  followingLabel = 'يتابعهم',
  onFollowersPress,
  onFollowingPress,
}: ProfileStatsGridProps) {
  const items = [
    { label: 'المتابعون', value: followers, icon: 'people-outline' as const, onPress: onFollowersPress },
    { label: followingLabel, value: following, icon: 'person-add-outline' as const, onPress: onFollowingPress },
  ];

  return (
    <View style={styles.grid}>
      {items.map((item) => {
        const content = <><Ionicons name={item.icon} size={20} color={colors.accent} /><Text style={styles.value}>{item.value.toLocaleString('ar')}</Text><Text style={styles.label}>{item.label}</Text></>;
        return item.onPress ? (
          <Pressable key={item.label} style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={item.onPress} accessibilityRole="button" accessibilityLabel={`${item.value.toLocaleString('ar')} ${item.label}`}>
            {content}
          </Pressable>
        ) : (
          <View key={item.label} style={styles.card} accessibilityLabel={`${item.value.toLocaleString('ar')} ${item.label}`}>{content}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.md, marginBottom: spacing.xl },
  card: { flex: 1, minHeight: 92, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  value: { color: colors.text, fontSize: fontSizes.xl, fontWeight: '900', fontVariant: ['tabular-nums'] },
  label: { color: colors.textDim, fontSize: fontSizes.xs, fontWeight: '700', marginTop: 1, textAlign: 'center' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});

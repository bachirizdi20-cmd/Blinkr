import React from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import PosterCard from './PosterCard';
import { ProfileMediaItem } from '../lib/profile-media';
import { colors, spacing } from '../lib/theme';

type Props<T extends ProfileMediaItem> = {
  items: T[];
  onOpen: (item: T) => void;
  onRemove?: (item: T) => void;
  horizontalPadding?: number;
};

export function ProfileFavoriteRail<T extends ProfileMediaItem>({
  items,
  onOpen,
  onRemove,
  horizontalPadding = spacing.lg,
}: Props<T>) {
  const { width } = useWindowDimensions();
  const availableWidth = Math.max(0, width - horizontalPadding * 2);
  const cardWidth = Math.min(128, Math.max(88, Math.floor((availableWidth - spacing.md * 2) / 2.7)));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.rail, { gap: spacing.sm, paddingHorizontal: horizontalPadding }]}
    >
      {items.map((item) => (
        <View key={`${item.mediaType}-${item.mediaId}`} style={{ width: cardWidth }}>
          <PosterCard
            item={{
              id: item.mediaId,
              mediaType: item.mediaType,
              title: item.title,
              posterPath: item.posterPath,
              date: item.date ?? undefined,
              voteAverage: item.voteAverage ?? undefined,
            }}
            width={cardWidth}
            onPress={() => onOpen(item)}
            showRating={false}
            uniform
          />
          {onRemove ? (
            <Pressable
              onPress={() => onRemove(item)}
              hitSlop={8}
              style={({ pressed }) => [styles.heartBadge, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`إزالة ${item.title} من المفضلة`}
            >
              <Ionicons name="heart" size={12} color={colors.accent} />
            </Pressable>
          ) : (
            <View pointerEvents="none" style={styles.heartBadge} accessibilityLabel="ضمن المفضلات">
              <Ionicons name="heart" size={12} color={colors.accent} />
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { paddingVertical: spacing.xs, alignItems: 'flex-start' },
  heartBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,13,18,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(242,245,248,0.16)',
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.94 }] },
});

import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import PosterCard from './PosterCard';
import { ProfileMediaItem } from '../lib/profile-media';
import { colors, radius, spacing } from '../lib/theme';

type Props<T extends ProfileMediaItem> = {
  items: T[];
  onOpen: (item: T) => void;
  onAddFavorite?: () => void;
  horizontalPadding?: number;
  availableWidthPadding?: number;
};

export function ProfileFavoriteRail<T extends ProfileMediaItem>({
  items,
  onOpen,
  onAddFavorite,
  horizontalPadding = spacing.lg,
  availableWidthPadding = horizontalPadding,
}: Props<T>) {
  const { width } = useWindowDimensions();
  const availableWidth = Math.max(0, width - availableWidthPadding * 2);
  const cardWidth = Math.min(96, Math.max(48, Math.floor((availableWidth - spacing.xs * 4) / 5)));

  return (
    <View style={[styles.grid, { paddingHorizontal: horizontalPadding, columnGap: spacing.xs }]}>
      {items.slice(0, 5).map((item) => (
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
            showMetadata={false}
          />
        </View>
      ))}
      {onAddFavorite ? Array.from({ length: Math.max(0, 5 - items.length) }, (_, index) => (
        <Pressable
          key={`add-favorite-${index}`}
          onPress={onAddFavorite}
          accessibilityRole="button"
          accessibilityLabel="إضافة فيلم أو مسلسل إلى المفضلات"
          style={({ pressed }) => [styles.addCard, { width: cardWidth, height: cardWidth * 1.5 }, pressed && styles.addCardPressed]}
        >
          <View style={styles.addButton}><Ionicons name="add" size={27} color={colors.bg} /></View>
        </Pressable>
      )) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' },
  addCard: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.accent, backgroundColor: colors.surface },
  addCardPressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  addButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
});

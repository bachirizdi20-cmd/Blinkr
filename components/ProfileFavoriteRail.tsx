import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import PosterCard from './PosterCard';
import { ProfileMediaItem } from '../lib/profile-media';
import { spacing } from '../lib/theme';

type Props<T extends ProfileMediaItem> = {
  items: T[];
  onOpen: (item: T) => void;
  horizontalPadding?: number;
  availableWidthPadding?: number;
};

export function ProfileFavoriteRail<T extends ProfileMediaItem>({
  items,
  onOpen,
  horizontalPadding = spacing.lg,
  availableWidthPadding = horizontalPadding,
}: Props<T>) {
  const { width } = useWindowDimensions();
  const availableWidth = Math.max(0, width - availableWidthPadding * 2);
  const cardWidth = Math.min(96, Math.max(48, Math.floor((availableWidth - spacing.xs * 4) / 5)));

  return (
    <View style={[styles.grid, { paddingHorizontal: horizontalPadding, columnGap: spacing.xs }]}>
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
            showMetadata={false}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' },
});

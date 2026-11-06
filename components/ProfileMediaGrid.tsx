import React from 'react';
import { useWindowDimensions, View, StyleSheet } from 'react-native';
import PosterCard from './PosterCard';
import EmptyState from './EmptyState';
import { ProfileMediaItem } from '../lib/profile-media';
import { spacing } from '../lib/theme';

export function ProfileMediaGrid({
  items,
  onOpen,
  emptyTitle,
  emptyMessage,
  emptyIcon = 'bookmark-outline',
}: {
  items: ProfileMediaItem[];
  onOpen: (item: ProfileMediaItem) => void;
  emptyTitle: string;
  emptyMessage: string;
  emptyIcon?: React.ComponentProps<typeof EmptyState>['icon'];
}) {
  const { width } = useWindowDimensions();
  const columns = width >= 1024 ? 6 : width >= 720 ? 4 : 3;
  const horizontalPadding = spacing.lg * 2;
  const gap = spacing.md;
  const cardWidth = Math.max(76, (width - horizontalPadding - gap * (columns - 1)) / columns);

  if (!items.length) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <View style={[styles.grid, { gap }]}>
      {items.map((item, index) => (
        <View key={`${item.mediaType}-${item.mediaId}-${index}`} style={{ width: cardWidth }}>
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
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', paddingBottom: spacing.sm } });

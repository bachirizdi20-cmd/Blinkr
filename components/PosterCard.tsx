import React from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { posterUrl } from '../lib/tmdb';
import { colors, radius, fontSizes, spacing } from '../lib/theme';

interface PosterItem {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
  date?: string;
  voteAverage?: number;
  isAnime?: boolean;
}

interface Props {
  item: PosterItem;
  onPress: () => void;
  width?: number;
  showRating?: boolean;
}

const { width: SCREEN_W } = Dimensions.get('window');

export default function PosterCard({ item, onPress, width, showRating = true }: Props) {
  const cardWidth = width ?? 108;
  const uri = posterUrl(item.posterPath, 'w342');
  const year = item.date ? item.date.slice(0, 4) : '';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width: cardWidth, opacity: pressed ? 0.75 : 1 }]}>
      <View style={[styles.posterWrap, { width: cardWidth, height: cardWidth * 1.5 }]}>
        {uri ? (
          <Image source={{ uri }} style={styles.poster} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.poster, styles.posterFallback]}>
            <Ionicons name="film-outline" size={28} color={colors.textFaint} />
          </View>
        )}
        {item.isAnime && (
          <View style={styles.animeBadge}>
            <Text style={styles.animeBadgeText}>ANIME</Text>
          </View>
        )}
        {showRating && !!item.voteAverage && item.voteAverage > 0 && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={10} color={colors.gold} />
            <Text style={styles.ratingText}>{item.voteAverage.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <Text numberOfLines={2} style={[styles.title, { width: cardWidth }]}>
        {item.title}
      </Text>
      {!!year && <Text style={styles.year}>{year}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  posterWrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    position: 'relative',
  },
  poster: { width: '100%', height: '100%' },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  ratingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(10,13,18,0.85)',
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: { color: colors.text, fontSize: 10, fontWeight: '700' },
  animeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.accent3,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  animeBadgeText: { color: '#04121B', fontSize: 8, fontWeight: '800', letterSpacing: 0.3 },
  title: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '600', marginTop: spacing.xs, lineHeight: 17 },
  year: { color: colors.textFaint, fontSize: fontSizes.xs, marginTop: 1 },
});

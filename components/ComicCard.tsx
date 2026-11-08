import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import { ComicSummary } from '../types/comics';

export default function ComicCard({ comic, onPress, width = 108 }: { comic: ComicSummary; onPress: () => void; width?: number }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { width, opacity: pressed ? 0.76 : 1 }]} accessibilityRole="button" accessibilityLabel={`عرض كوميك ${comic.title}`}>
    <View style={[styles.coverWrap, { height: width * 1.46 }]}>
      {comic.coverUrl ? <Image source={{ uri: comic.coverUrl }} style={styles.cover} contentFit="cover" transition={150} /> : <View style={[styles.cover, styles.fallback]}><Ionicons name="color-wand-outline" size={30} color={colors.textFaint} /><Text style={styles.noCover}>لا يتوفر غلاف</Text></View>}
      {comic.rating != null ? <View style={styles.rating}><Ionicons name="star" size={10} color={colors.gold} /><Text style={styles.ratingText}>{comic.rating.toFixed(1)}</Text></View> : null}
    </View>
    <Text style={styles.title} numberOfLines={2}>{comic.title}</Text>
    {comic.publisher ? <Text style={styles.meta} numberOfLines={1}>{comic.publisher}</Text> : comic.issueNumber ? <Text style={styles.meta}>العدد {comic.issueNumber}</Text> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { marginRight: spacing.sm },
  coverWrap: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface, position: 'relative' },
  cover: { width: '100%', height: '100%' },
  fallback: { alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.sm },
  noCover: { color: colors.textFaint, fontSize: 10, textAlign: 'center' },
  title: { color: colors.text, fontSize: fontSizes.sm, lineHeight: 17, fontWeight: '800', marginTop: spacing.xs },
  meta: { color: colors.textDim, fontSize: 10, marginTop: 3 },
  rating: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(10,13,18,0.88)', borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { color: colors.text, fontSize: 10, fontWeight: '700' },
});

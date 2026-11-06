import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import { bookCoverUrl } from '../lib/book-utils';
import { BookSummary } from '../types/books';

export default function BookCard({ book, onPress, width = 108 }: { book: BookSummary; onPress: () => void; width?: number }) {
  const author = book.authorNames.slice(0, 2).join('، ');
  const coverUrl = bookCoverUrl(book.coverUrl);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { width, opacity: pressed ? 0.76 : 1 }]} accessibilityRole="button" accessibilityLabel={`عرض كتاب ${book.title}`}>
      <View style={[styles.coverWrap, { height: width * 1.46 }]}>
        {coverUrl ? <Image source={{ uri: coverUrl }} style={styles.cover} contentFit="cover" transition={150} /> : <View style={[styles.cover, styles.fallback]}><Ionicons name="book-outline" size={30} color={colors.textFaint} /><Text style={styles.noCover}>لا يتوفر غلاف</Text></View>}
        {book.ratingsAverage != null && book.ratingsCount > 0 ? <View style={styles.rating}><Ionicons name="star" size={10} color={colors.gold} /><Text style={styles.ratingText}>{book.ratingsAverage.toFixed(1)} · Hardcover</Text></View> : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>{book.title}</Text>
      {author ? <Text style={styles.author} numberOfLines={1}>{author}</Text> : null}
      {book.firstPublishYear ? <Text style={styles.year}>{book.firstPublishYear}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginRight: spacing.sm },
  coverWrap: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface, position: 'relative' },
  cover: { width: '100%', height: '100%' },
  fallback: { alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.sm },
  noCover: { color: colors.textFaint, fontSize: 10, textAlign: 'center' },
  title: { color: colors.text, fontSize: fontSizes.sm, lineHeight: 17, fontWeight: '800', marginTop: spacing.xs },
  author: { color: colors.textDim, fontSize: 10, marginTop: 3 },
  year: { color: colors.textFaint, fontSize: fontSizes.xs, marginTop: 2 },
  rating: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(10,13,18,0.88)', borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { color: colors.text, fontSize: 10, fontWeight: '700' },
});

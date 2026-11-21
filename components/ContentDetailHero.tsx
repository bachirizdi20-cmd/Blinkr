import React, { ReactNode } from 'react';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type Props = {
  title: string;
  imageUri?: string | null;
  fallbackIcon: React.ComponentProps<typeof Ionicons>['name'];
  metadata?: Array<string | null | undefined>;
  scoreText?: string | null;
  scoreLabel?: string;
  children?: ReactNode;
};

export default function ContentDetailHero({ title, imageUri, fallbackIcon, metadata = [], scoreText, scoreLabel, children }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.artworkFrame}>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.artwork} contentFit="cover" transition={160} /> : <View style={[styles.artwork, styles.fallback]}><Ionicons name={fallbackIcon} size={38} color={colors.textFaint} /></View>}
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={3}>{title}</Text>
        {children}
        {metadata.filter((item): item is string => Boolean(item)).map((item, index) => <Text key={`${index}-${item}`} style={styles.meta} numberOfLines={2}>{item}</Text>)}
        {scoreText ? <View style={styles.scoreRow}><Ionicons name="star" size={15} color={colors.gold} /><Text style={styles.score}>{scoreText}</Text>{scoreLabel ? <Text style={styles.scoreLabel}>{scoreLabel}</Text> : null}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.md, minHeight: 184 },
  artworkFrame: { width: 124, height: 184, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
  artwork: { width: '100%', height: '100%' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, alignItems: 'flex-end', gap: spacing.sm, paddingTop: 2 },
  title: { color: colors.text, fontSize: fontSizes.xl, lineHeight: 28, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  meta: { color: colors.textDim, fontSize: fontSizes.sm, lineHeight: 19, textAlign: 'right', writingDirection: 'rtl' },
  scoreRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  score: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '900' },
  scoreLabel: { color: colors.textFaint, fontSize: fontSizes.xs, fontWeight: '700' },
});

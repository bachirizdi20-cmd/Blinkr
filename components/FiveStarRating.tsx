import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import RatingStars from './RatingStars';
import { colors, fontSizes, spacing } from '../lib/theme';

type Props = {
  rating: number;
  onChange?: (rating: number) => void;
  size?: number;
  showValue?: boolean;
};

export default function FiveStarRating({ rating, onChange, size = 21, showValue = false }: Props) {
  const normalized = Math.max(0, Math.min(10, Number.isFinite(rating) ? rating : 0));
  const stars = normalized / 2;
  return (
    <View style={styles.container}>
      <RatingStars
        rating={stars}
        size={size}
        color={colors.accent}
        interactive={Boolean(onChange)}
        onChange={onChange ? (value) => onChange(value * 2) : undefined}
      />
      {showValue ? <Text style={styles.value}>{normalized > 0 ? `${String(stars).replace('.', ',')} / 5` : '— / 5'}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
  value: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '800', writingDirection: 'ltr' },
});

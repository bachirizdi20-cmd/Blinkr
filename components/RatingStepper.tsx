import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type Props = {
  rating: number;
  onChange: (value: number) => void;
  label?: string;
};

export default function RatingStepper({ rating, onChange, label = 'تقييمك' }: Props) {
  const value = Math.max(0, Math.min(10, Math.round((Number.isFinite(rating) ? rating : 0) * 2) / 2));
  const change = (delta: number) => onChange(Math.max(0, Math.min(10, Math.round((value + delta) * 2) / 2)));
  const valueLabel = value.toFixed(1).replace(/\.0$/, '');

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => change(0.5)}
          disabled={value >= 10}
          style={({ pressed }) => [styles.control, pressed && styles.pressed, value >= 10 && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel="زيادة التقييم نصف درجة"
        >
          <Ionicons name="add" size={21} color={colors.accent} />
        </Pressable>
        <View style={styles.valueGroup} accessibilityLiveRegion="polite">
          <Ionicons name="star" size={19} color={colors.accent} />
          <Text style={styles.value}>{valueLabel}/10</Text>
        </View>
        <Pressable
          onPress={() => change(-0.5)}
          disabled={value <= 0}
          style={({ pressed }) => [styles.control, pressed && styles.pressed, value <= 0 && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel="خفض التقييم نصف درجة"
        >
          <Ionicons name="remove" size={21} color={colors.accent} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm },
  label: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '800' },
  row: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  control: { width: 38, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  valueGroup: { minWidth: 94, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  value: { color: colors.text, fontSize: fontSizes.xl, fontWeight: '900', fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  disabled: { opacity: 0.35 },
});

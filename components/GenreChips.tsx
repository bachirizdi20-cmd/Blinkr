import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, fontSizes, spacing } from '../lib/theme';

export default function GenreChips({ names }: { names: string[] }) {
  if (!names.length) return null;
  return (
    <View style={styles.row}>
      {names.map((n) => (
        <View key={n} style={styles.chip}>
          <Text style={styles.chipText}>{n}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { color: colors.textDim, fontSize: fontSizes.xs, fontWeight: '600' },
});

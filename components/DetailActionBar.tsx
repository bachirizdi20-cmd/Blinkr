import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type Props = {
  completed: boolean;
  inList: boolean;
  completionLabel: string;
  listLabel: string;
  onReview: () => void;
  onToggleList: () => void;
  onToggleCompleted: () => void;
  rating: number;
  onRatingChange: (value: number) => void;
};

export default function DetailActionBar({ completed, inList, completionLabel, listLabel, onReview, onToggleList, onToggleCompleted, rating, onRatingChange }: Props) {
  const normalizedRating = Math.max(0, Math.min(10, Math.round(rating * 2) / 2));
  const ratingLabel = normalizedRating.toFixed(1).replace('.0', '').replace('.', ',');
  const stepRating = (delta: number) => onRatingChange(Math.max(0, Math.min(10, Math.round((normalizedRating + delta) * 2) / 2)));
  return (
    <View style={styles.card}>
      <View style={styles.actionsRow}>
        <Action icon="create-outline" label="تسجيل مراجعة" onPress={onReview} />
        <Action icon={inList ? 'bookmark' : 'bookmark-outline'} label={listLabel} active={inList} onPress={onToggleList} />
        <Action icon={completed ? 'checkmark-circle' : 'checkmark-circle-outline'} label={completionLabel} active={completed} onPress={onToggleCompleted} />
      </View>
      <View style={styles.ratingRow}>
        <Pressable style={styles.stepButton} onPress={() => stepRating(-0.5)} accessibilityRole="button" accessibilityLabel="إنقاص التقييم"><Text style={styles.stepText}>−</Text></Pressable>
        <View style={styles.ratingValue}><Text style={styles.ratingText}>{ratingLabel}/10</Text><Ionicons name="star" size={20} color={colors.accent} /></View>
        <Pressable style={styles.stepButton} onPress={() => stepRating(0.5)} accessibilityRole="button" accessibilityLabel="زيادة التقييم"><Text style={styles.stepText}>+</Text></Pressable>
      </View>
    </View>
  );
}

function Action({ icon, label, active, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; active?: boolean; onPress: () => void }) {
  return <Pressable style={({ pressed }) => [styles.action, active && styles.actionActive, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}><Ionicons name={icon} size={25} color={active ? colors.accent : colors.text} /><Text style={[styles.actionLabel, active && styles.actionLabelActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionsRow: { flexDirection: 'row-reverse', gap: spacing.xs },
  action: { flex: 1, minHeight: 78, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 3, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.surfaceHigh },
  actionActive: { borderColor: colors.accent, backgroundColor: 'rgba(51,214,166,0.10)' },
  actionLabel: { color: colors.textDim, fontSize: 11, lineHeight: 16, textAlign: 'center', fontWeight: '800', writingDirection: 'rtl' },
  actionLabelActive: { color: colors.accent },
  ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  stepButton: { width: 48, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.borderLight },
  stepText: { color: colors.accent, fontSize: 28, lineHeight: 30, fontWeight: '700' },
  ratingValue: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ratingText: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '900', writingDirection: 'ltr' },
  pressed: { opacity: 0.72 },
});

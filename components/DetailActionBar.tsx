import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import RatingStepper from './RatingStepper';
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
  inProgress?: boolean;
  inProgressLabel?: string;
  startProgressLabel?: string;
  onToggleInProgress?: () => void;
};

export default function DetailActionBar({ completed, inList, completionLabel, listLabel, onReview, onToggleList, onToggleCompleted, rating, onRatingChange, inProgress = false, inProgressLabel, startProgressLabel, onToggleInProgress }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.actionsRow}>
        <Action icon="create-outline" label="تسجيل مراجعة" onPress={onReview} />
        <Action icon={inList ? 'bookmark' : 'bookmark-outline'} label={listLabel} active={inList} onPress={onToggleList} />
        <Action icon={completed ? 'checkmark-circle' : 'checkmark-circle-outline'} label={completionLabel} active={completed} onPress={onToggleCompleted} />
      </View>
      <View style={styles.ratingRow}>
        <View style={styles.ratingHeading}><Text style={styles.ratingCaption}>تقييمك</Text><FiveStarRating rating={rating} onChange={onRatingChange} size={22} /></View>
      </View>
      {onToggleInProgress && inProgressLabel ? <Pressable style={[styles.progressButton, inProgress && styles.progressButtonActive]} onPress={onToggleInProgress} accessibilityRole="button" accessibilityLabel={inProgress ? inProgressLabel : (startProgressLabel ?? inProgressLabel)}><Ionicons name={inProgress ? 'play-circle' : 'play-circle-outline'} size={18} color={inProgress ? colors.accent : colors.textDim} /><Text style={[styles.progressText, inProgress && styles.progressTextActive]}>{inProgress ? inProgressLabel : (startProgressLabel ?? inProgressLabel)}</Text></Pressable> : null}
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
  ratingRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  progressButton: { minHeight: 42, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.borderLight },
  progressButtonActive: { borderColor: colors.accent, backgroundColor: 'rgba(51,214,166,0.08)' },
  progressText: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '800' },
  progressTextActive: { color: colors.accent },
  pressed: { opacity: 0.72 },
});

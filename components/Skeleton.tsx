import React from 'react';
import { View, type ViewProps } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, radius, spacing } from '../lib/theme';

type SkeletonProps = ViewProps & { width?: number | `${number}%`; height?: number; radiusValue?: number };

export function Skeleton({ width = '100%', height = 14, radiusValue = radius.sm, style, ...props }: SkeletonProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={[{ width, height, borderRadius: radiusValue, backgroundColor: colors.surfaceHigh }, style]}
      {...props}
    />
  );
}

export function ProfileSkeleton() {
  return (
    <View style={{ padding: spacing.lg, gap: spacing.lg }} accessibilityLabel="Loading profile">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Skeleton width={64} height={64} radiusValue={32} />
        <View style={{ flex: 1, gap: spacing.sm }}><Skeleton width="62%" height={18} /><Skeleton width="88%" height={12} /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}><Skeleton height={64} /><Skeleton height={64} /><Skeleton height={64} /></View>
      <Skeleton height={18} width="34%" />
      {[1, 2, 3].map((item) => <View key={item} style={{ gap: spacing.sm }}><Skeleton height={70} radiusValue={radius.md} /><Skeleton width="70%" height={12} /></View>)}
    </View>
  );
}

export function ReviewsSkeleton() {
  return (
    <View style={{ gap: spacing.sm }} accessibilityLabel="Loading reviews">
      {[1, 2, 3].map((item) => (
        <View key={item} style={{ padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}><Skeleton width={34} height={34} radiusValue={17} /><View style={{ flex: 1, gap: 5 }}><Skeleton width="42%" height={12} /><Skeleton width="28%" height={10} /></View><Skeleton width={42} height={12} /></View>
          <Skeleton width="58%" height={15} />
          <Skeleton height={12} />
          <Skeleton width="82%" height={12} />
        </View>
      ))}
    </View>
  );
}

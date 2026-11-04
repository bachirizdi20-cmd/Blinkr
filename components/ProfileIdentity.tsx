import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, spacing } from '../lib/theme';

export function ProfileIdentity({
  name,
  avatar,
  badge,
  stats,
}: {
  name: string;
  avatar: ReactNode;
  badge?: ReactNode;
  stats?: ReactNode;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.avatarWrap}>{avatar}</View>
      <View style={styles.info}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={2}>{name}</Text>
          {badge}
        </View>
        {stats ? <View style={styles.stats}>{stats}</View> : null}
      </View>
    </View>
  );
}

export function ProfileBio({ bio, fallback }: { bio?: string | null; fallback: string }) {
  return <Text style={styles.bio}>{bio?.trim() || fallback}</Text>;
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.xs },
  avatarWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1, minWidth: 0, gap: spacing.xs },
  nameLine: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  name: { color: colors.text, fontSize: 18, lineHeight: 22, fontWeight: '800', flexShrink: 1, textAlign: 'right', writingDirection: 'rtl' },
  stats: { minWidth: 0, alignSelf: 'stretch' },
  bio: { color: colors.textDim, fontSize: fontSizes.sm, lineHeight: 22, textAlign: 'right', writingDirection: 'rtl', alignSelf: 'stretch', marginTop: spacing.md, marginBottom: spacing.md },
});

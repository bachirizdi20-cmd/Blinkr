import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, spacing } from '../lib/theme';

export function ProfileIdentity({
  name,
  avatar,
  badge,
  actions,
}: {
  name: string;
  avatar: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <>
      <View style={styles.hero}>
        <View style={styles.avatarWrap}>{avatar}</View>
        <View style={styles.info}>
          <View style={styles.nameLine}>
            <Text style={styles.name} numberOfLines={2}>{name}</Text>
            {badge}
          </View>
        </View>
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </>
  );
}

export function ProfileBio({ bio, fallback }: { bio?: string | null; fallback: string }) {
  return <Text style={styles.bio}>{bio?.trim() || fallback}</Text>;
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  avatarWrap: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  name: { color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  actions: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xs },
  bio: { color: colors.textDim, fontSize: fontSizes.sm, lineHeight: 23, textAlign: 'right', marginTop: spacing.xs, marginBottom: spacing.sm },
});

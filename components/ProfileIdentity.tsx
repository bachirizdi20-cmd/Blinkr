import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSizes, spacing } from '../lib/theme';

export function ProfileIdentity({
  name,
  username,
  bio,
  joinedAt,
  avatar,
  badge,
  actions,
  bioFallback = 'لم تتم إضافة نبذة شخصية بعد.',
  showBio = true,
}: {
  name: string;
  username: string;
  bio?: string | null;
  joinedAt?: string | null;
  avatar: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  bioFallback?: string;
  showBio?: boolean;
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
          <Text style={styles.username} numberOfLines={1}>@{username}</Text>
          {joinedAt ? (
            <View style={styles.joinedAt}>
              <Ionicons name="calendar-outline" size={13} color={colors.textDim} />
              <Text style={styles.joinedText}>عضو منذ {joinedAt}</Text>
            </View>
          ) : null}
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
      </View>
      {showBio ? <ProfileBio bio={bio} fallback={bioFallback} /> : null}
    </>
  );
}

export function ProfileBio({ bio, fallback }: { bio?: string | null; fallback: string }) {
  return <Text style={styles.bio}>{bio?.trim() || fallback}</Text>;
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  avatarWrap: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1, minWidth: 0, gap: 4 },
  nameLine: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  name: { color: colors.text, fontSize: 21, lineHeight: 27, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  username: { color: colors.textDim, fontSize: fontSizes.sm, lineHeight: 19, textAlign: 'right' },
  actions: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  bio: { color: colors.textDim, fontSize: fontSizes.sm, lineHeight: 23, textAlign: 'right', marginTop: spacing.xs, marginBottom: spacing.md },
  joinedAt: { flexDirection: 'row-reverse', alignItems: 'center', alignSelf: 'flex-end', gap: 5, marginTop: 1 },
  joinedText: { color: colors.textDim, fontSize: 11, lineHeight: 16, textAlign: 'right' },
});

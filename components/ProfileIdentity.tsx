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
              <Ionicons name="calendar-outline" size={13} color={colors.textFaint} />
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
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md },
  avatarWrap: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, minWidth: 0, gap: 5 },
  nameLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  name: { color: colors.text, fontSize: fontSizes.xl, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  username: { color: colors.textFaint, fontSize: fontSizes.sm, textAlign: 'right' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  bio: { color: colors.textDim, fontSize: fontSizes.sm, lineHeight: 22, textAlign: 'right', marginTop: spacing.xs, marginBottom: spacing.md },
  joinedAt: { flexDirection: 'row-reverse', alignItems: 'center', alignSelf: 'flex-start', gap: 5, marginTop: 1 },
  joinedText: { color: colors.textFaint, fontSize: 10, textAlign: 'right' },
});

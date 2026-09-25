import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import UserAvatar from '../components/UserAvatar';
import EmptyState from '../components/EmptyState';
import ApiErrorState from '../components/ApiErrorState';
import { ContentStackParamList } from '../navigation/types';
import { trpc } from '../lib/trpc';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type RouteT = RouteProp<ContentStackParamList, 'UserProfile'>;

export default function UserProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const paramId = route.params.userId;
  const isRemote = paramId.startsWith('remote-');
  const numericId = isRemote ? Number(paramId.replace('remote-', '')) : null;

  if (isRemote && numericId) {
    return <RemoteUserProfile userId={numericId} onBack={() => navigation.goBack()} onMessage={() => navigation.navigate('Conversation', { userId: paramId })} />;
  }
  return (
    <SafeAreaView style={styles.safe}>
      <EmptyState icon="alert-circle-outline" title="User not found" message="This profile is no longer available." />
    </SafeAreaView>
  );
}

function RemoteUserProfile({ userId, onBack, onMessage }: { userId: number; onBack: () => void; onMessage: () => void }) {
  const profileQuery = trpc.social.profile.useQuery({ userId });
  const followMutation = trpc.social.toggleFollow.useMutation({ onSuccess: () => profileQuery.refetch() });
  const cancelRequestMutation = trpc.social.cancelFollowRequest.useMutation({ onSuccess: () => profileQuery.refetch() });
  const blockMutation = trpc.social.block.useMutation({ onSuccess: () => { Alert.alert('User blocked', "You won't see each other's content anymore."); onBack(); } });
  const reportMutation = trpc.social.report.useMutation({ onSuccess: () => Alert.alert('Report sent', "Thanks — our team will review it.") });
  const [menuOpen, setMenuOpen] = useState(false);

  const confirmBlock = () => {
    setMenuOpen(false);
    Alert.alert('Block this user?', 'They will no longer be able to follow you, message you, or see your reviews.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: () => blockMutation.mutate({ userId }) },
    ]);
  };

  const confirmReport = () => {
    setMenuOpen(false);
    Alert.alert('Report this user?', 'Let us know why you\u2019re reporting this account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Spam', onPress: () => reportMutation.mutate({ targetType: 'user', targetId: userId, reason: 'spam' }) },
      { text: 'Harassment', onPress: () => reportMutation.mutate({ targetType: 'user', targetId: userId, reason: 'harassment' }) },
      { text: 'Other', onPress: () => reportMutation.mutate({ targetType: 'user', targetId: userId, reason: 'other' }) },
    ]);
  };

  if (profileQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}><ActivityIndicator color={colors.accent} /></View>
      </SafeAreaView>
    );
  }

  if (profileQuery.isError) {
    return (
      <SafeAreaView style={styles.safe}>
        <ApiErrorState message="Couldn't load this profile." onRetry={() => profileQuery.refetch()} />
      </SafeAreaView>
    );
  }

  const profile = profileQuery.data;
  if (!profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState icon="alert-circle-outline" title="User not found" />
      </SafeAreaView>
    );
  }

  const displayName = profile.name ?? profile.username ?? 'Blinkr user';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <Pressable onPress={() => setMenuOpen((v) => !v)} hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
        </Pressable>
      </View>
      {menuOpen && (
        <View style={styles.menuCard}>
          <Pressable style={styles.menuItem} onPress={confirmReport}>
            <Ionicons name="flag-outline" size={16} color={colors.text} />
            <Text style={styles.menuItemText}>Report user</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={confirmBlock}>
            <Ionicons name="ban-outline" size={16} color={colors.danger} />
            <Text style={[styles.menuItemText, { color: colors.danger }]}>Block user</Text>
          </Pressable>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <UserAvatar name={displayName} color={colors.accent} size={100} imageUrl={profile.avatarUrl ?? undefined} />
        <View style={styles.nameBlock}>
          <Text style={styles.name}>{displayName}</Text>
          {profile.followsYou && (
            <View style={styles.followsYouTag}>
              <Text style={styles.followsYouText}>Follows you</Text>
            </View>
          )}
        </View>
        <Text style={styles.username}>@{profile.username ?? 'user'}</Text>
        {profile.locked ? (
          <View style={styles.lockedNotice}>
            <Ionicons name="lock-closed-outline" size={14} color={colors.textFaint} />
            <Text style={styles.lockedText}>This account is private. Follow to see their bio, stats, and reviews.</Text>
          </View>
        ) : (
          <>
            {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{(profile.followerCount ?? 0).toLocaleString()}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{(profile.followingCount ?? 0).toLocaleString()}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actionBtn, (profile.isFollowing || profile.followRequested) ? styles.followingBtn : styles.followBtn]}
            disabled={followMutation.isPending || cancelRequestMutation.isPending}
            onPress={() => profile.followRequested ? cancelRequestMutation.mutate({ targetId: userId }) : followMutation.mutate({ userId })}
          >
            <Ionicons name={profile.isFollowing || profile.followRequested ? 'checkmark' : 'person-add'} size={16} color={profile.isFollowing || profile.followRequested ? colors.text : '#04120C'} />
            <Text style={[styles.actionBtnText, (profile.isFollowing || profile.followRequested) ? styles.followingBtnText : styles.followBtnText]}>
              {profile.isFollowing ? 'Following' : profile.followRequested ? 'Requested' : 'Follow'}
            </Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.messageBtn]} onPress={onMessage}>
            <Ionicons name="chatbubble-outline" size={16} color={colors.text} />
            <Text style={[styles.actionBtnText, { color: colors.text }]}>Message</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  headerTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '800' },
  content: { alignItems: 'center', padding: spacing.lg, paddingTop: spacing.md },
  nameBlock: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  name: { color: colors.text, fontSize: fontSizes.xl, fontWeight: '800' },
  followsYouTag: { backgroundColor: colors.surfaceHigh, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  followsYouText: { color: colors.textDim, fontSize: 10, fontWeight: '700' },
  username: { color: colors.textFaint, fontSize: fontSizes.sm, marginTop: 2 },
  bio: { color: colors.textDim, fontSize: fontSizes.sm, textAlign: 'center', marginTop: spacing.md, lineHeight: 20, paddingHorizontal: spacing.md },
  genreTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  genreText: { color: colors.text, fontSize: fontSizes.xs, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl, width: '100%' },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.accent, fontSize: fontSizes.lg, fontWeight: '800' },
  statLabel: { color: colors.textFaint, fontSize: 10, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  actionsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl, width: '100%' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.md, paddingVertical: spacing.sm + 4 },
  followBtn: { backgroundColor: colors.accent },
  followingBtn: { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  messageBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionBtnText: { fontWeight: '800', fontSize: fontSizes.sm },
  followBtnText: { color: '#04120C' },
  followingBtnText: { color: colors.text },
  menuCard: { position: 'absolute', top: 44, right: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 4, zIndex: 10, elevation: 6 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 10, minWidth: 160 },
  menuItemText: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '600' },
  lockedNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.md, maxWidth: 280 },
  lockedText: { color: colors.textFaint, fontSize: fontSizes.xs, flexShrink: 1 },
});

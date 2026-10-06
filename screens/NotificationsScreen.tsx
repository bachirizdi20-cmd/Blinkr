import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/use-auth';
import { ContentStackParamList } from '../navigation/types';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import { resolveMediaUrl } from '../lib/media-url';
import { matchesNotificationFilter, NOTIFICATION_COPY, type NotificationFilter, type NotificationKind } from '../lib/notification-utils';
import GeneralErrorState from '../components/GeneralErrorState';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type FilterMode = NotificationFilter;
type NotificationItem = {
  id: number;
  userId: number;
  actorId: number | null;
  kind: NotificationKind;
  reviewId: number | null;
  conversationId: number | null;
  readAt: Date | null;
  createdAt: Date | string;
  actorName: string | null;
  actorUsername: string | null;
  actorAvatarUrl: string | null;
  reviewTitle: string | null;
  reviewPosterPath: string | null;
  reviewRating: number | null;
};

const FILTERS: { key: FilterMode; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'follows', label: 'Follows' },
  { key: 'messages', label: 'Messages' },
];

function actorLabel(item: NotificationItem) {
  return item.actorName || item.actorUsername || 'Someone';
}

function relativeTime(value: Date | string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${Math.max(1, seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dayGroup(value: Date | string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay ? 'Today' : 'Yesterday';
}

function posterUri(path: string | null) {
  if (!path) return undefined;
  return path.startsWith('http') ? path : `https://image.tmdb.org/t/p/w154${path}`;
}

export default function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const query = trpc.social.notifications.useQuery(undefined, { enabled: Boolean(user) });
  const markRead = trpc.social.markNotificationsRead.useMutation({ onSuccess: () => query.refetch() });
  const markOneRead = trpc.social.markNotificationRead.useMutation({ onSuccess: () => query.refetch() });
  const followingQuery = trpc.social.following.useQuery(undefined, { enabled: Boolean(user) });
  const followBackMutation = trpc.social.toggleFollow.useMutation({ onSuccess: () => followingQuery.refetch() });
  const followRequestsQuery = trpc.social.followRequests.useQuery(undefined, { enabled: Boolean(user) });
  const respondRequestMutation = trpc.social.respondToFollowRequest.useMutation({ onSuccess: () => followRequestsQuery.refetch() });
  const unreadCount = query.data?.filter((item) => !item.readAt).length ?? 0;
  const previousCount = useRef<number | null>(null);
  const [newNotificationId, setNewNotificationId] = useState<number | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const arrivalProgress = useRef(new Animated.Value(1)).current;
  const bellProgress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const currentCount = query.data?.length ?? 0;
    if (previousCount.current !== null && currentCount > previousCount.current && query.data?.[0]) {
      setNewNotificationId(query.data[0].id);
      arrivalProgress.setValue(0);
      bellProgress.setValue(0.72);
      Animated.parallel([
        Animated.timing(arrivalProgress, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(bellProgress, { toValue: 1.12, duration: 160, useNativeDriver: true }),
          Animated.timing(bellProgress, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
      ]).start();
    }
    previousCount.current = currentCount;
  }, [query.data, arrivalProgress, bellProgress]);

  const filteredNotifications = useMemo(() => (query.data ?? []).filter((item) => matchesNotificationFilter(item.kind, filterMode)), [filterMode, query.data]);

  const handleNotificationPress = (item: NotificationItem) => {
    if (!item.readAt) markOneRead.mutate({ notificationId: item.id });
    if (item.kind === 'message' && item.actorId) navigation.navigate('Conversation', { userId: `remote-${item.actorId}` });
    else if (item.kind === 'follow') navigation.navigate('People');
    else if (item.reviewId) navigation.navigate('Reviews');
  };

  const handleFollowBack = (actorId: number | null) => {
    if (!actorId || followingQuery.data?.includes(actorId) || followBackMutation.isPending) return;
    followBackMutation.mutate({ userId: actorId });
  };

  const showSettings = () => {
    Alert.alert('Notification settings', 'Choose how Blinkr should show your social activity.', [
      { text: notificationsEnabled ? 'Turn off notifications' : 'Turn on notifications', onPress: () => setNotificationsEnabled((value) => !value) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (query.isLoading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.accent} style={styles.loader} /></SafeAreaView>;
  if (query.isError) return <SafeAreaView style={styles.safe}><GeneralErrorState title="Unable to load notifications" message={query.error.message} onRetry={() => query.refetch()} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />}
        contentContainerStyle={filteredNotifications.length === 0 ? styles.emptyList : styles.list}
        ListHeaderComponent={<>
          <View style={styles.header}>
            <View style={styles.headingBlock}><Text style={styles.title}>Notifications</Text><Text style={styles.subtitle}>Stay updated with your movie circle</Text></View>
            <View style={styles.headerActions}><Pressable onPress={() => markRead.mutate()} disabled={markRead.isPending || unreadCount === 0} style={({ pressed }) => [styles.markAllButton, (pressed || unreadCount === 0) && styles.mutedAction]}><Text style={styles.markAll}>{markRead.isPending ? 'Updating…' : 'Mark all as read'}</Text></Pressable><Animated.View style={{ transform: [{ scale: bellProgress }] }}><Pressable onPress={showSettings} style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]} accessibilityLabel="Notification settings"><Ionicons name="settings-outline" size={24} color={colors.text} /></Pressable></Animated.View></View>
          </View>
          {(followRequestsQuery.data?.length ?? 0) > 0 ? <View style={styles.requestsSection}><Text style={styles.requestsTitle}>Follow requests</Text>{followRequestsQuery.data?.map(({ request, name, username, avatarUrl }) => <View key={request.id} style={styles.requestRow}>{resolveMediaUrl(avatarUrl) ? <Image source={{ uri: resolveMediaUrl(avatarUrl) }} style={styles.requestAvatar} contentFit="cover" /> : <View style={styles.requestAvatarPlaceholder}><Ionicons name="person-outline" size={18} color={colors.textDim} /></View>}<View style={styles.requestCopy}><Text style={styles.requestName}>{name ?? username ?? 'Blinkr user'}</Text><Text style={styles.requestHandle}>@{username ?? 'blinkr_user'} wants to follow you</Text></View><View style={styles.requestActions}><Pressable style={styles.acceptButton} disabled={respondRequestMutation.isPending} onPress={() => respondRequestMutation.mutate({ requesterId: request.requesterId, accept: true })}><Text style={styles.acceptText}>Accept</Text></Pressable><Pressable style={styles.rejectButton} disabled={respondRequestMutation.isPending} onPress={() => respondRequestMutation.mutate({ requesterId: request.requesterId, accept: false })}><Text style={styles.rejectText}>Decline</Text></Pressable></View></View>)}</View> : null}
          <View style={styles.filters}>{FILTERS.map((filter) => <Pressable key={filter.key} onPress={() => setFilterMode(filter.key)} style={({ pressed }) => [styles.filterChip, filterMode === filter.key && styles.filterChipActive, pressed && styles.pressed]}><Text style={[styles.filterText, filterMode === filter.key && styles.filterTextActive]}>{filter.label}</Text></Pressable>)}</View>
        </>}
        ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyOrb}><Ionicons name="notifications-outline" size={42} color={colors.accent} /></View><Text style={styles.emptyTitle}>{filterMode === 'all' ? 'Your social story starts here' : 'Nothing here yet'}</Text><Text style={styles.emptyText}>{filterMode === 'all' ? 'When someone follows you, likes a review, or leaves a comment, it will appear here.' : 'New activity matching this filter will appear here.'}</Text></View>}
        renderItem={({ item, index }) => {
          const isNew = item.id === newNotificationId;
          const animatedStyle = isNew ? { opacity: arrivalProgress, transform: [{ translateY: arrivalProgress.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] } : undefined;
          const isFollowing = Boolean(item.actorId && followingQuery.data?.includes(item.actorId));
          const actor = actorLabel(item);
          const poster = posterUri(item.reviewPosterPath);
          const showDay = index === 0 || dayGroup(filteredNotifications[index - 1].createdAt) !== dayGroup(item.createdAt);
          return <Animated.View style={animatedStyle}>
            {showDay ? <Text style={styles.dayLabel}>{dayGroup(item.createdAt)}</Text> : null}
            <View style={[styles.row, !item.readAt && styles.unread]}>
              <Pressable onPress={() => handleNotificationPress(item)} style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${actor} ${NOTIFICATION_COPY[item.kind]}`}>
                {resolveMediaUrl(item.actorAvatarUrl) ? <Image source={{ uri: resolveMediaUrl(item.actorAvatarUrl) }} style={styles.avatar} contentFit="cover" /> : <View style={styles.avatarPlaceholder}><Ionicons name={item.kind === 'follow' ? 'person-add-outline' : item.kind === 'like' ? 'heart' : item.kind === 'message' ? 'chatbubble-ellipses' : 'chatbubble'} size={20} color={colors.text} /></View>}
                <View style={styles.copy}><Text style={styles.message}><Text style={styles.actor}>{actor}</Text> {NOTIFICATION_COPY[item.kind]}</Text><Text style={styles.detail} numberOfLines={2}>{item.kind === 'follow' ? `@${item.actorUsername ?? 'blinkr_user'}` : item.kind === 'message' ? 'Open conversation' : item.reviewTitle ?? 'Your review'}</Text><Text style={styles.time}>{relativeTime(item.createdAt)}</Text></View>
              </Pressable>
              <View style={styles.trailing}>{item.kind === 'follow' && item.actorId ? <Pressable onPress={() => handleFollowBack(item.actorId)} disabled={isFollowing || followBackMutation.isPending} style={({ pressed }) => [styles.followButton, isFollowing && styles.followingButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={isFollowing ? 'Following' : 'Follow back'}>{followBackMutation.isPending && !isFollowing ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={styles.followButtonText}>{isFollowing ? 'Following' : 'Follow back'}</Text>}</Pressable> : poster ? <Image source={{ uri: poster }} style={styles.poster} contentFit="cover" /> : <View style={styles.posterPlaceholder}><Ionicons name={item.kind === 'like' ? 'heart-outline' : 'chatbubble-outline'} size={19} color={colors.textDim} /></View>}{!item.readAt ? <View style={styles.unreadDot} /> : null}</View>
            </View>
          </Animated.View>;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  loader: { flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  emptyList: { flexGrow: 1, paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 4, paddingBottom: 14 },
  headingBlock: { flex: 1 },
  title: { color: '#F7F9FB', fontSize: 30, lineHeight: 35, fontWeight: '900', letterSpacing: -0.7 },
  subtitle: { color: '#8D99A8', fontSize: 14, lineHeight: 19, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
  markAllButton: { paddingTop: 11, paddingBottom: 10 },
  markAll: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  mutedAction: { opacity: 0.45 },
  settingsButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', gap: 8, paddingBottom: 16 },
  requestsSection: { backgroundColor: '#0C1219', borderWidth: 1, borderColor: '#1F806F', borderRadius: 16, padding: 12, marginBottom: 14 },
  requestsTitle: { color: '#F7F9FB', fontSize: 15, fontWeight: '900', marginBottom: 10 },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7 },
  requestAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceHigh },
  requestAvatarPlaceholder: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#26303B' },
  requestCopy: { flex: 1, minWidth: 0 },
  requestName: { color: colors.text, fontSize: 13, fontWeight: '800' },
  requestHandle: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  requestActions: { flexDirection: 'row', gap: 5 },
  acceptButton: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  acceptText: { color: '#03110E', fontSize: 11, fontWeight: '900' },
  rejectButton: { borderWidth: 1, borderColor: '#44515E', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  rejectText: { color: colors.textDim, fontSize: 11, fontWeight: '800' },
  filterChip: { minHeight: 40, paddingHorizontal: 15, borderRadius: 22, backgroundColor: '#101720', borderWidth: 1, borderColor: '#1D2935', alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { backgroundColor: '#14D5AA', borderColor: '#14D5AA' },
  filterText: { color: '#A8B1BE', fontSize: 14, fontWeight: '800' },
  filterTextActive: { color: '#03110E' },
  dayLabel: { color: '#F2F5F8', fontSize: 15, fontWeight: '800', marginBottom: 8, marginTop: 2 },
  row: { minHeight: 88, flexDirection: 'row', alignItems: 'center', backgroundColor: '#0C1219', borderWidth: 1, borderColor: '#17232E', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4 },
  unread: { borderColor: '#1F806F' },
  rowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceHigh },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#26303B', borderWidth: 1, borderColor: '#465464' },
  copy: { flex: 1, minWidth: 0 },
  message: { color: '#B5BFCC', fontSize: 14, lineHeight: 19 },
  actor: { color: '#F7F9FB', fontWeight: '900' },
  detail: { color: '#B5BFCC', fontSize: 14, lineHeight: 19, marginTop: 1 },
  time: { color: '#8B96A4', fontSize: 12, marginTop: 2 },
  trailing: { alignItems: 'flex-end', justifyContent: 'center', gap: 7, marginLeft: 6 },
  poster: { width: 46, height: 64, borderRadius: 5, backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: '#2C3946' },
  posterPlaceholder: { width: 46, height: 64, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111A24', borderWidth: 1, borderColor: '#2C3946' },
  unreadDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
  followButton: { minWidth: 98, minHeight: 38, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  followingButton: { borderColor: '#44515E', backgroundColor: '#151D26' },
  followButtonText: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 80 },
  emptyOrb: { width: 108, height: 108, borderRadius: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20, 213, 170, 0.10)', borderWidth: 1, borderColor: 'rgba(20, 213, 170, 0.35)', marginBottom: 20 },
  emptyTitle: { color: colors.text, fontSize: 23, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: colors.textDim, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8, maxWidth: 320 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});

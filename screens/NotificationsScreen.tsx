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
import GeneralErrorState from '../components/GeneralErrorState';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type FilterMode = 'all' | 'mentions' | 'likes' | 'comments' | 'follows';
type NotificationItem = {
  id: number;
  userId: number;
  actorId: number | null;
  kind: 'follow' | 'like' | 'comment';
  reviewId: number | null;
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
];

const COPY = {
  follow: 'started following you',
  like: 'liked your review',
  comment: 'commented on your review',
} as const;

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

  const filteredNotifications = useMemo(() => (query.data ?? []).filter((item) => filterMode === 'all' || (filterMode === 'mentions' ? false : item.kind === filterMode.slice(0, -1))), [filterMode, query.data]);

  const handleNotificationPress = (item: NotificationItem) => {
    if (!item.readAt) markOneRead.mutate({ notificationId: item.id });
    if (item.kind === 'follow') navigation.navigate('People');
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
              <Pressable onPress={() => handleNotificationPress(item)} style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${actor} ${COPY[item.kind]}`}>
                {item.actorAvatarUrl ? <Image source={{ uri: item.actorAvatarUrl }} style={styles.avatar} contentFit="cover" /> : <View style={styles.avatarPlaceholder}><Ionicons name={item.kind === 'follow' ? 'person-add-outline' : item.kind === 'like' ? 'heart' : 'chatbubble'} size={20} color={colors.text} /></View>}
                <View style={styles.copy}><Text style={styles.message}><Text style={styles.actor}>{actor}</Text> {COPY[item.kind]}</Text><Text style={styles.detail} numberOfLines={2}>{item.kind === 'follow' ? `@${item.actorUsername ?? 'blinkr_user'}` : item.reviewTitle ?? 'Your review'}</Text><Text style={styles.time}>{relativeTime(item.createdAt)}</Text></View>
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
  list: { paddingHorizontal: 24, paddingBottom: 28 },
  emptyList: { flexGrow: 1, paddingHorizontal: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 8, paddingBottom: 22 },
  headingBlock: { flex: 1 },
  title: { color: '#F7F9FB', fontSize: 34, lineHeight: 40, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { color: '#8D99A8', fontSize: 17, lineHeight: 22, marginTop: 3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 12 },
  markAllButton: { paddingTop: 11, paddingBottom: 10 },
  markAll: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  mutedAction: { opacity: 0.45 },
  settingsButton: { width: 45, height: 45, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', gap: 12, paddingBottom: 26 },
  filterChip: { minHeight: 50, paddingHorizontal: 21, borderRadius: 26, backgroundColor: '#101720', borderWidth: 1, borderColor: '#1D2935', alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { backgroundColor: '#14D5AA', borderColor: '#14D5AA' },
  filterText: { color: '#A8B1BE', fontSize: 16, fontWeight: '800' },
  filterTextActive: { color: '#03110E' },
  dayLabel: { color: '#F2F5F8', fontSize: 17, fontWeight: '800', marginBottom: 12, marginTop: 3 },
  row: { minHeight: 126, flexDirection: 'row', alignItems: 'center', backgroundColor: '#0C1219', borderWidth: 1, borderColor: '#17232E', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 4 },
  unread: { borderColor: '#1F806F' },
  rowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.surfaceHigh },
  avatarPlaceholder: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', backgroundColor: '#26303B', borderWidth: 1, borderColor: '#465464' },
  copy: { flex: 1, minWidth: 0 },
  message: { color: '#B5BFCC', fontSize: 17, lineHeight: 23 },
  actor: { color: '#F7F9FB', fontWeight: '900' },
  detail: { color: '#B5BFCC', fontSize: 17, lineHeight: 23, marginTop: 1 },
  time: { color: '#8B96A4', fontSize: 15, marginTop: 3 },
  trailing: { alignItems: 'flex-end', justifyContent: 'center', gap: 13, marginLeft: 8 },
  poster: { width: 59, height: 82, borderRadius: 6, backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: '#2C3946' },
  posterPlaceholder: { width: 59, height: 82, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111A24', borderWidth: 1, borderColor: '#2C3946' },
  unreadDot: { width: 17, height: 17, borderRadius: 9, backgroundColor: colors.accent },
  followButton: { minWidth: 134, minHeight: 51, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  followingButton: { borderColor: '#44515E', backgroundColor: '#151D26' },
  followButtonText: { color: colors.accent, fontSize: 15, fontWeight: '900' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 80 },
  emptyOrb: { width: 108, height: 108, borderRadius: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20, 213, 170, 0.10)', borderWidth: 1, borderColor: 'rgba(20, 213, 170, 0.35)', marginBottom: 20 },
  emptyTitle: { color: colors.text, fontSize: 23, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: colors.textDim, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8, maxWidth: 320 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});

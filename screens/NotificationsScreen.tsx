import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/use-auth';
import { ContentStackParamList } from '../navigation/types';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import GeneralErrorState from '../components/GeneralErrorState';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type FilterMode = 'all' | 'unread';

const COPY = {
  follow: 'بدأ بمتابعتك',
  like: 'أعجب بمراجعتك',
  comment: 'علّق على مراجعتك',
} as const;

function formatDate(value: string | Date) {
  const date = new Date(value);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const query = trpc.social.notifications.useQuery(undefined, { enabled: Boolean(user) });
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [actionError, setActionError] = useState<string | null>(null);
  const markRead = trpc.social.markNotificationsRead.useMutation({ onSuccess: () => query.refetch(), onError: () => setActionError('Could not update notifications. Try again.') });
  const markOneRead = trpc.social.markNotificationRead.useMutation({ onSuccess: () => query.refetch(), onError: () => setActionError('Could not mark this notification as read.') });
  const followingQuery = trpc.social.following.useQuery(undefined, { enabled: Boolean(user) });
  const followBackMutation = trpc.social.toggleFollow.useMutation({ onSuccess: () => followingQuery.refetch(), onError: () => setActionError('Could not follow this person. Try again.') });
  const unreadCount = query.data?.filter((item) => !item.readAt).length ?? 0;
  const visibleNotifications = (query.data ?? []).filter((item) => filterMode === 'all' || !item.readAt);
  const previousCount = useRef<number | null>(null);
  const [newNotificationId, setNewNotificationId] = useState<number | null>(null);
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

  const handleNotificationPress = (item: NonNullable<typeof query.data>[number]) => {
    if (!item.readAt) markOneRead.mutate({ notificationId: item.id });
    if (item.kind === 'follow') navigation.navigate('People');
    else if (item.reviewId && item.actorId) navigation.navigate('Conversation', { userId: String(item.actorId) });
    else if (item.reviewId) navigation.navigate('Reviews');
  };

  const handleFollowBack = (actorId: number | null) => {
    setActionError(null);
    if (!actorId || followingQuery.data?.includes(actorId) || followBackMutation.isPending) return;
    followBackMutation.mutate({ userId: actorId });
  };

  const handleMarkAll = () => {
    setActionError(null);
    markRead.mutate();
  };

  if (query.isLoading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.accent} style={styles.loader} /></SafeAreaView>;
  if (query.isError) return <SafeAreaView style={styles.safe}><GeneralErrorState title="Unable to load notifications" message={query.error.message} onRetry={() => query.refetch()} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
        <View style={styles.titleWrap}><Animated.View style={{ transform: [{ scale: bellProgress }] }}><Ionicons name="notifications" size={21} color={colors.accent} /></Animated.View><Text style={styles.title}>Notifications</Text>{unreadCount > 0 ? <View style={styles.countBadge}><Text style={styles.countText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View> : null}</View>
        {unreadCount > 0 ? <Pressable onPress={handleMarkAll} disabled={markRead.isPending} style={({ pressed }) => [styles.markAllButton, pressed && styles.pressed]}><Text style={styles.markAll}>{markRead.isPending ? 'Updating…' : 'Mark all read'}</Text></Pressable> : <View style={{ width: 24 }} />}
      </View>
      <View style={styles.subHeader}><Text style={styles.subTitle}>{unreadCount > 0 ? `${unreadCount} unread ${unreadCount === 1 ? 'update' : 'updates'}` : 'Your latest activity'}</Text><View style={styles.filterGroup}><Pressable onPress={() => setFilterMode('all')} style={[styles.filter, filterMode === 'all' && styles.filterActive]} accessibilityRole="tab" accessibilityState={{ selected: filterMode === 'all' }}><Text style={[styles.filterText, filterMode === 'all' && styles.filterTextActive]}>All</Text></Pressable><Pressable onPress={() => setFilterMode('unread')} style={[styles.filter, filterMode === 'unread' && styles.filterActive]} accessibilityRole="tab" accessibilityState={{ selected: filterMode === 'unread' }}><Text style={[styles.filterText, filterMode === 'unread' && styles.filterTextActive]}>Unread</Text></Pressable></View></View>
      {actionError ? <Pressable onPress={() => setActionError(null)} style={styles.actionError} accessibilityRole="alert"><Ionicons name="alert-circle-outline" size={16} color={colors.danger} /><Text style={styles.actionErrorText}>{actionError}</Text><Ionicons name="close" size={15} color={colors.danger} /></Pressable> : null}
      <FlatList
        data={visibleNotifications}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />}
        contentContainerStyle={visibleNotifications.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyGlow}><View style={styles.emptyOrb}><Ionicons name={filterMode === 'unread' ? 'checkmark-done-outline' : 'notifications-outline'} size={42} color={colors.accent} /></View></View><Text style={styles.emptyEyebrow}>{filterMode === 'unread' ? 'ALL CAUGHT UP' : 'YOUR SOCIAL SCREENPLAY'}</Text><Text style={styles.emptyTitle}>{filterMode === 'unread' ? 'Nothing new right now' : 'The story starts here'}</Text><Text style={styles.emptyText}>{filterMode === 'unread' ? 'You have read every update. New likes, comments, and follows will appear here.' : 'When someone follows you, likes a review, or leaves a comment, the moment will appear in this space.'}</Text>{filterMode === 'unread' ? <Pressable onPress={() => setFilterMode('all')} style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}><Text style={styles.emptyButtonText}>View all activity</Text></Pressable> : null}</View>}
        renderItem={({ item }) => {
          const isNew = item.id === newNotificationId;
          const animatedStyle = isNew ? { opacity: arrivalProgress, transform: [{ translateY: arrivalProgress.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] } : undefined;
          const isFollowing = Boolean(item.actorId && followingQuery.data?.includes(item.actorId));
          return <Animated.View style={animatedStyle}>
            <View style={[styles.row, !item.readAt && styles.unread]}>
              <Pressable onPress={() => { setActionError(null); handleNotificationPress(item); }} style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${COPY[item.kind]} notification`}>
                <View style={[styles.icon, !item.readAt && styles.iconUnread]}><Ionicons name={item.kind === 'follow' ? 'person-add-outline' : item.kind === 'like' ? 'heart-outline' : 'chatbubble-outline'} size={20} color={colors.accent} /></View>
                <View style={styles.copy}><Text style={styles.text}>{COPY[item.kind]}.</Text><Text style={styles.date}>{formatDate(item.createdAt)}</Text></View>{!item.readAt ? <View style={styles.unreadDot} /> : <Ionicons name="chevron-forward" size={17} color={colors.textFaint} />}
              </Pressable>
              {item.kind === 'follow' && item.actorId ? <Pressable onPress={() => handleFollowBack(item.actorId)} disabled={isFollowing || followBackMutation.isPending} style={({ pressed }) => [styles.quickAction, isFollowing && styles.quickActionDone, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={isFollowing ? 'Following' : 'Follow back'}>{followBackMutation.isPending && !isFollowing ? <ActivityIndicator size="small" color={colors.bg} /> : <><Ionicons name={isFollowing ? 'checkmark' : 'person-add'} size={14} color={isFollowing ? colors.accent : colors.bg} /><Text style={[styles.quickActionText, isFollowing && styles.quickActionDoneText]}>{isFollowing ? 'Following' : 'Follow back'}</Text></>}</Pressable> : null}
              {item.kind === 'comment' && item.actorId ? <Pressable onPress={() => handleNotificationPress(item)} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Reply"><Ionicons name="chatbubble-ellipses" size={14} color={colors.bg} /><Text style={styles.quickActionText}>Reply</Text></Pressable> : null}
            </View>
          </Animated.View>;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  title: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '800' },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  markAllButton: { paddingVertical: 6, paddingHorizontal: 4 },
  subHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  subTitle: { color: colors.textDim, fontSize: fontSizes.xs, fontWeight: '700' },
  filterGroup: { flexDirection: 'row', gap: 4, padding: 3, borderRadius: 14, backgroundColor: colors.surface },
  filter: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 11 },
  filterActive: { backgroundColor: colors.surfaceHigh },
  filterText: { color: colors.textFaint, fontSize: 10, fontWeight: '800' },
  filterTextActive: { color: colors.text },
  actionError: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: 'rgba(239, 68, 68, 0.10)' },
  actionErrorText: { flex: 1, color: colors.danger, fontSize: fontSizes.xs, fontWeight: '700' },
  countBadge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  countText: { color: colors.bg, fontSize: 11, fontWeight: '900' },
  markAll: { color: colors.accent, fontSize: 11, fontWeight: '800' },
  loader: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.sm },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minWidth: 0 },
  quickAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.accent },
  quickActionDone: { backgroundColor: 'rgba(53, 211, 153, 0.12)', borderWidth: 1, borderColor: 'rgba(53, 211, 153, 0.35)' },
  quickActionText: { color: colors.bg, fontSize: 10, fontWeight: '900' },
  quickActionDoneText: { color: colors.accent },
  unread: { borderColor: colors.accent },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh },
  iconUnread: { backgroundColor: 'rgba(53, 211, 153, 0.16)' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  copy: { flex: 1 },
  text: { color: colors.text, fontSize: fontSizes.md, fontWeight: '700' },
  date: { color: colors.textFaint, fontSize: fontSizes.xs, marginTop: 3 },
  empty: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
  emptyGlow: { width: 132, height: 132, borderRadius: 66, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(53, 211, 153, 0.07)', marginBottom: spacing.lg },
  emptyOrb: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: 'rgba(53, 211, 153, 0.28)', shadowColor: colors.accent, shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  emptyEyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  emptyTitle: { color: colors.text, fontSize: 23, fontWeight: '900', marginTop: spacing.sm, textAlign: 'center' },
  emptyText: { color: colors.textDim, textAlign: 'center', marginTop: spacing.sm, lineHeight: 21, maxWidth: 320 },
  emptyButton: { marginTop: spacing.lg, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.accent },
  emptyButtonText: { color: colors.bg, fontSize: fontSizes.xs, fontWeight: '900' },
});

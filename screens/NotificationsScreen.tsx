import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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

const COPY = {
  follow: 'بدأ بمتابعتك',
  like: 'أعجب بمراجعتك',
  comment: 'علّق على مراجعتك',
} as const;

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
  const [filterMode, setFilterMode] = useState<'all' | 'mentions' | 'likes' | 'comments' | 'follows'>('all');
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
    if (!actorId || followingQuery.data?.includes(actorId) || followBackMutation.isPending) return;
    followBackMutation.mutate({ userId: actorId });
  };

  if (query.isLoading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.accent} style={styles.loader} /></SafeAreaView>;
  if (query.isError) return <SafeAreaView style={styles.safe}><GeneralErrorState title="Unable to load notifications" message={query.error.message} onRetry={() => query.refetch()} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headingBlock}>
          <View style={styles.titleLine}><Text style={styles.title}>Notifications</Text>{unreadCount > 0 ? <View style={styles.countBadge}><Text style={styles.countText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View> : null}</View>
          <Text style={styles.subtitle}>Stay updated with your movie circle</Text>
        </View>
        <View style={styles.headerActions}>
          {unreadCount > 0 ? <Pressable onPress={() => markRead.mutate()} disabled={markRead.isPending} style={({ pressed }) => [styles.markAllButton, pressed && styles.pressed]}><Text style={styles.markAll}>{markRead.isPending ? 'Updating…' : 'Mark all as read'}</Text></Pressable> : null}
          <Pressable onPress={() => Alert.alert('Notification settings', 'Notification preferences will be available here soon.')} style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]} accessibilityLabel="Notification settings"><Ionicons name="settings-outline" size={20} color={colors.textDim} /></Pressable>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {(['all', 'mentions', 'likes', 'comments', 'follows'] as const).map((mode) => (
          <Pressable key={mode} onPress={() => setFilterMode(mode)} style={({ pressed }) => [styles.filterChip, filterMode === mode && styles.filterChipActive, pressed && styles.pressed]}>
            <Text style={[styles.filterText, filterMode === mode && styles.filterTextActive]}>{mode[0].toUpperCase() + mode.slice(1)}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <FlatList
        data={(query.data ?? []).filter((item) => filterMode === 'all' || (filterMode === 'mentions' ? false : item.kind === filterMode.slice(0, -1)))}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />}
        contentContainerStyle={(query.data ?? []).filter((item) => filterMode === 'all' || (filterMode === 'mentions' ? false : item.kind === filterMode.slice(0, -1))).length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyGlow}><View style={styles.emptyOrb}><Ionicons name="notifications-outline" size={42} color={colors.accent} /></View></View><Text style={styles.emptyEyebrow}>{filterMode === 'all' ? 'YOUR SOCIAL SCREENPLAY' : 'FILTERED NOTIFICATIONS'}</Text><Text style={styles.emptyTitle}>{filterMode === 'all' ? 'The story starts here' : 'Nothing here yet'}</Text><Text style={styles.emptyText}>{filterMode === 'all' ? 'When someone follows you, likes a review, or leaves a comment, the moment will appear in this space.' : 'New activity matching this filter will appear here.'}</Text></View>}
        renderItem={({ item }) => {
          const isNew = item.id === newNotificationId;
          const animatedStyle = isNew ? { opacity: arrivalProgress, transform: [{ translateY: arrivalProgress.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] } : undefined;
          const isFollowing = Boolean(item.actorId && followingQuery.data?.includes(item.actorId));
          return <Animated.View style={animatedStyle}>
            <View style={[styles.row, !item.readAt && styles.unread]}>
              <Pressable onPress={() => handleNotificationPress(item)} style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${COPY[item.kind]} notification`}>
                <View style={styles.avatarPlaceholder}><Ionicons name={item.kind === 'follow' ? 'person-add-outline' : item.kind === 'like' ? 'heart-outline' : 'chatbubble-outline'} size={18} color={colors.accent} /></View>
                <View style={styles.copy}><Text style={styles.text}>{COPY[item.kind]}.</Text><Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text></View>{!item.readAt ? <View style={styles.unreadDot} /> : <Ionicons name="chevron-forward" size={17} color={colors.textFaint} />}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  headingBlock: { flex: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.6 },
  subtitle: { color: colors.textFaint, fontSize: fontSizes.xs, marginTop: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: spacing.sm },
  settingsButton: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  markAllButton: { paddingVertical: 10, paddingHorizontal: 4 },
  countBadge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  countText: { color: colors.bg, fontSize: 11, fontWeight: '900' },
  markAll: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  filters: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  filterChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.textDim, fontSize: 12, fontWeight: '800' },
  filterTextActive: { color: colors.bg },
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
  avatarPlaceholder: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
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
});

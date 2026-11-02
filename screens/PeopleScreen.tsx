import React, { useMemo, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, FlatList, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import UserAvatar from '../components/UserAvatar';
import EmptyState from '../components/EmptyState';
import ApiErrorState from '../components/ApiErrorState';
import { ContentStackParamList } from '../navigation/types';
import { useAuth } from '../hooks/use-auth';
import { trpc } from '../lib/trpc';
import { PeopleFilter } from '../types/social';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type RouteT = RouteProp<ContentStackParamList, 'People'>;

export default function PeopleScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { user } = useAuth();
  const [filter, setFilter] = useState<PeopleFilter>(route.params?.initialFilter ?? 'all');
  const [query, setQuery] = useState('');
  const remoteUsers = trpc.social.users.useQuery({ query }, { enabled: Boolean(user) });
  const remoteFollowing = trpc.social.following.useQuery(undefined, { enabled: Boolean(user) });
  const remoteFollowers = trpc.social.followers.useQuery(undefined, { enabled: Boolean(user) });
  const followMutation = trpc.social.toggleFollow.useMutation({
    onSuccess: () => {
      void Promise.all([remoteFollowing.refetch(), remoteFollowers.refetch()]);
    },
  });
  const shareMutation = trpc.social.shareMedia.useMutation({ onSuccess: () => navigation.goBack() });
  const shareMedia = route.params?.shareMedia;

  const remoteFollowingIds = useMemo(
    () => new Set((remoteFollowing.data ?? []).map((id) => `remote-${id}`)),
    [remoteFollowing.data],
  );
  const remoteFollowerIds = useMemo(
    () => new Set((remoteFollowers.data ?? []).map((id) => `remote-${id}`)),
    [remoteFollowers.data],
  );

  const people = useMemo(() => (remoteUsers.data ?? []).map((item) => ({
    id: `remote-${item.id}`,
    username: item.username ?? `user${item.id}`,
    displayName: item.name ?? item.username ?? 'مستخدم Blinkr',
    bio: item.bio ?? '',
    avatarUrl: item.avatarUrl ?? undefined,
    avatarColor: colors.accent,
    followsYou: remoteFollowerIds.has(`remote-${item.id}`),
  })), [remoteUsers.data, remoteFollowerIds]);

  const filtered = useMemo(() => {
    let list = people;
    if (filter === 'following') list = list.filter((person) => remoteFollowingIds.has(person.id));
    if (filter === 'followers') list = list.filter((person) => remoteFollowerIds.has(person.id));
    const needle = query.trim().toLowerCase();
    if (needle) list = list.filter((person) => person.displayName.toLowerCase().includes(needle) || person.username.toLowerCase().includes(needle));
    return list;
  }, [people, filter, query, remoteFollowingIds, remoteFollowerIds]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="رجوع">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>اكتشف الأشخاص</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          placeholder="ابحث بالاسم أو اسم المستخدم"
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
          accessibilityLabel="البحث عن مستخدم"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="مسح البحث">
            <Ionicons name="close-circle" size={16} color={colors.textFaint} />
          </Pressable>
        )}
      </View>

      <View style={styles.filterRow}>
        {(['all', 'following', 'followers'] as PeopleFilter[]).map((value) => (
          <Pressable key={value} onPress={() => setFilter(value)} style={[styles.pill, filter === value && styles.pillActive]}>
            <Text style={[styles.pillText, filter === value && styles.pillTextActive]}>
              {value === 'all' ? 'الكل' : value === 'following' ? 'أتابعهم' : 'يتابعونني'}
            </Text>
          </Pressable>
        ))}
      </View>

      {!user ? (
        <EmptyState icon="person-outline" title="سجّل الدخول" message="سجّل الدخول لاكتشاف مستخدمي Blinkr وملفاتهم الشخصية." />
      ) : remoteUsers.isLoading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color={colors.accent} /><Text style={styles.loadingText}>جارٍ تحميل الأشخاص…</Text></View>
      ) : remoteUsers.isError ? (
        <ApiErrorState message="تعذر تحميل الأشخاص الآن." onRetry={() => remoteUsers.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="people-outline" title="لا يوجد أشخاص" message="جرّب اسمًا آخر أو غيّر عامل التصفية." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const following = remoteFollowingIds.has(item.id);
            const numericId = Number(item.id.replace('remote-', ''));
            return (
              <View style={styles.row}>
                <Pressable
                  style={styles.personButton}
                  onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`فتح الملف الشخصي لـ ${item.displayName}`}
                >
                  <UserAvatar name={item.displayName} color={item.avatarColor} size={50} imageUrl={item.avatarUrl} />
                  <View style={styles.personCopy}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>{item.displayName}</Text>
                      {item.followsYou ? <View style={styles.followsYouTag}><Text style={styles.followsYouText}>يتابعك</Text></View> : null}
                    </View>
                    <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
                    <Text style={styles.bio} numberOfLines={1}>{item.bio || 'لم يضف نبذة بعد'}</Text>
                  </View>
                </Pressable>
                <Pressable
                  style={[styles.followBtn, following && styles.followingBtn]}
                  disabled={followMutation.isPending}
                  onPress={() => followMutation.mutate({ userId: numericId })}
                  accessibilityRole="button"
                  accessibilityLabel={following ? `إلغاء متابعة ${item.displayName}` : `متابعة ${item.displayName}`}
                >
                  <Text style={[styles.followBtnText, following && styles.followingBtnText]}>
                    {following ? 'تتابعه' : 'متابعة'}
                  </Text>
                </Pressable>
                {shareMedia ? (
                  <Pressable
                    style={styles.shareBtn}
                    disabled={shareMutation.isPending}
                    onPress={() => shareMutation.mutate({ otherUserId: numericId, ...shareMedia })}
                    accessibilityLabel={`مشاركة ${shareMedia.title} مع ${item.displayName}`}
                  >
                    <Ionicons name="paper-plane-outline" size={16} color={colors.accent} />
                  </Pressable>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '800' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 46, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  searchInput: { flex: 1, color: colors.text, fontSize: fontSizes.sm, textAlign: 'right' },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '700' },
  pillTextActive: { color: '#04120C' },
  list: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  personButton: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  personCopy: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, color: colors.text, fontSize: fontSizes.md, fontWeight: '700' },
  followsYouTag: { backgroundColor: colors.surfaceHigh, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
  followsYouText: { color: colors.textDim, fontSize: 9, fontWeight: '700' },
  username: { color: colors.textFaint, fontSize: fontSizes.xs, marginTop: 1, textAlign: 'right' },
  bio: { color: colors.textDim, fontSize: fontSizes.xs, marginTop: 2, textAlign: 'right' },
  followBtn: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8 },
  followingBtn: { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  followBtnText: { color: '#04120C', fontSize: fontSizes.xs, fontWeight: '800' },
  followingBtnText: { color: colors.text },
  shareBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { color: colors.textDim, fontSize: fontSizes.sm },
});

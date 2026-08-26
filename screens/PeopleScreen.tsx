import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import UserAvatar from '../components/UserAvatar';
import EmptyState from '../components/EmptyState';
import { ContentStackParamList } from '../navigation/types';
import { useSocial } from '../context/SocialContext';
import { useAuth } from '../hooks/use-auth';
import { trpc } from '../lib/trpc';
import { PeopleFilter } from '../types/social';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type RouteT = RouteProp<ContentStackParamList, 'People'>;

export default function PeopleScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const social = useSocial();
  const { user } = useAuth();
  const [filter, setFilter] = useState<PeopleFilter>(route.params?.initialFilter ?? 'all');
  const [query, setQuery] = useState('');
  const remoteUsers = trpc.social.users.useQuery({ query }, { enabled: Boolean(user) });
  const remoteFollowing = trpc.social.following.useQuery(undefined, { enabled: Boolean(user) });
  const followMutation = trpc.social.toggleFollow.useMutation({ onSuccess: () => remoteFollowing.refetch() });

  const people = useMemo(() => {
    if (!remoteUsers.data?.length) return social.users;
    return remoteUsers.data.map((item) => ({
      id: `remote-${item.id}`,
      username: item.username ?? `user${item.id}`,
      displayName: item.name ?? item.username ?? 'Reelog user',
      bio: item.bio ?? '',
      avatarColor: colors.accent,
      favoriteGenre: '',
      followsYou: false,
    }));
  }, [remoteUsers.data, social.users]);

  const remoteFollowingIds = useMemo(() => new Set((remoteFollowing.data ?? []).map((id) => `remote-${id}`)), [remoteFollowing.data]);

  const filtered = useMemo(() => {
    let list = people;
    if (filter === 'following') list = list.filter((u) => u.id.startsWith('remote-') ? remoteFollowingIds.has(u.id) : social.isFollowing(u.id));
    if (filter === 'followers') list = list.filter((u) => u.followsYou);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((u) => u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
    return list;
  }, [people, social.followingIds, remoteFollowingIds, filter, query]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Discover People</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or username"
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={styles.filterRow}>
        {(['all', 'following', 'followers'] as PeopleFilter[]).map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} style={[styles.pill, filter === f && styles.pillActive]}>
            <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>
              {f === 'all' ? 'All' : f === 'following' ? 'Following' : 'Followers'}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 ? (
        <EmptyState icon="people-outline" title="No people found" message="Try a different search or filter." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const following = item.id.startsWith('remote-') ? remoteFollowingIds.has(item.id) : social.isFollowing(item.id);
            return (
              <Pressable style={styles.row} onPress={() => navigation.navigate('UserProfile', { userId: item.id })}>
                <UserAvatar name={item.displayName} color={item.avatarColor} size={50} />
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{item.displayName}</Text>
                    {item.followsYou && (
                      <View style={styles.followsYouTag}>
                        <Text style={styles.followsYouText}>Follows you</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.username}>@{item.username}</Text>
                  <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text>
                </View>
                <Pressable
                  style={[styles.followBtn, following && styles.followingBtn]}
                  onPress={() => item.id.startsWith('remote-') ? followMutation.mutate({ userId: Number(item.id.replace('remote-', '')) }) : social.toggleFollow(item.id)}
                >
                  <Text style={[styles.followBtnText, following && styles.followingBtnText]}>
                    {following ? 'Following' : 'Follow'}
                  </Text>
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  headerTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '800' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: fontSizes.sm },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '700' },
  pillTextActive: { color: '#04120C' },
  list: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.text, fontSize: fontSizes.md, fontWeight: '700' },
  followsYouTag: { backgroundColor: colors.surfaceHigh, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
  followsYouText: { color: colors.textDim, fontSize: 9, fontWeight: '700' },
  username: { color: colors.textFaint, fontSize: fontSizes.xs, marginTop: 1 },
  bio: { color: colors.textDim, fontSize: fontSizes.xs, marginTop: 2 },
  followBtn: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8 },
  followingBtn: { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  followBtnText: { color: '#04120C', fontSize: fontSizes.xs, fontWeight: '800' },
  followingBtnText: { color: colors.text },
});

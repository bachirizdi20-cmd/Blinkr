import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import UserAvatar from '../components/UserAvatar';
import EmptyState from '../components/EmptyState';
import { ContentStackParamList } from '../navigation/types';
import { useSocial } from '../context/SocialContext';
import { useAuth } from '../hooks/use-auth';
import { trpc } from '../lib/trpc';
import { MockUser } from '../types/social';
import { formatRelativeTime } from '../lib/format';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;

export default function ChatsScreen() {
  const navigation = useNavigation<Nav>();
  const social = useSocial();
  const { user: authUser } = useAuth();
  const remoteUsersQuery = trpc.social.users.useQuery({ query: '' }, { enabled: Boolean(authUser), retry: 1 });
  const [query, setQuery] = useState('');

  const remoteContacts = useMemo<MockUser[]>(
    () => (remoteUsersQuery.data ?? []).map((item) => ({
      id: `remote-${item.id}`,
      username: item.username ?? `user${item.id}`,
      displayName: item.name ?? item.username ?? 'Blinkr user',
      bio: item.bio ?? '',
      avatarColor: colors.accent,
      favoriteGenre: '',
      followsYou: false,
    })),
    [remoteUsersQuery.data]
  );

  const allContacts = useMemo(() => {
    const seen = new Set<string>();
    return [...remoteContacts, ...social.users].filter((contact) => {
      if (seen.has(contact.id)) return false;
      seen.add(contact.id);
      return true;
    });
  }, [remoteContacts, social.users]);

  const newFollowers = useMemo(
    () => allContacts.filter((u) => !u.id.startsWith('remote-') && u.followsYou && !social.isFollowing(u.id)),
    [allContacts, social.followingIds]
  );

  const contacts = useMemo(
    () => allContacts.filter((u) => u.id.startsWith('remote-') || social.isFollowing(u.id) || u.followsYou),
    [allContacts, social.followingIds]
  );

  const conversationRows = useMemo(() => {
    return contacts
      .map((user) => {
        const convo = social.getConversation(user.id);
        const lastMessage = convo.messages[convo.messages.length - 1];
        return { user, convo, lastMessage };
      })
      .filter((row) => row.lastMessage)
      .sort((a, b) => (b.lastMessage?.createdAt ?? 0) - (a.lastMessage?.createdAt ?? 0));
  }, [contacts, social.conversations]);

  const startableContacts = useMemo(
    () => contacts.filter((u) => social.getConversation(u.id).messages.length === 0),
    [contacts, social.conversations]
  );

  const q = query.trim().toLowerCase();
  const filteredRows = q
    ? conversationRows.filter(
        (r) => r.user.displayName.toLowerCase().includes(q) || r.user.username.toLowerCase().includes(q)
      )
    : conversationRows;
  const filteredStartable = q
    ? startableContacts.filter(
        (u) => u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
      )
    : startableContacts;

  const openConversation = (user: MockUser) => navigation.navigate('Conversation', { userId: user.id });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        <Pressable style={styles.peopleBtn} onPress={() => navigation.navigate('People')}>
          <Ionicons name="person-add-outline" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search people"
          placeholderTextColor={colors.textFaint}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textFaint} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={filteredRows}
        keyExtractor={(row) => row.user.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {newFollowers.length > 0 && !q && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>New Followers</Text>
                <FlatList
                  data={newFollowers}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(u) => u.id}
                  contentContainerStyle={{ gap: spacing.md }}
                  renderItem={({ item }) => (
                    <Pressable style={styles.followerCard} onPress={() => navigation.navigate('UserProfile', { userId: item.id })}>
                      <UserAvatar name={item.displayName} color={item.avatarColor} size={56} ring />
                      <Text numberOfLines={1} style={styles.followerName}>{item.displayName}</Text>
                      <View style={styles.followBackBadge}>
                        <Text style={styles.followBackText}>Follow back</Text>
                      </View>
                    </Pressable>
                  )}
                />
              </View>
            )}

            {filteredStartable.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Start a Conversation</Text>
                <FlatList
                  data={filteredStartable}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(u) => u.id}
                  contentContainerStyle={{ gap: spacing.lg }}
                  renderItem={({ item }) => (
                    <Pressable style={styles.startCard} onPress={() => openConversation(item)}>
                      <UserAvatar name={item.displayName} color={item.avatarColor} size={56} />
                      <Text numberOfLines={1} style={styles.startName}>{item.displayName}</Text>
                    </Pressable>
                  )}
                />
              </View>
            )}

            {filteredRows.length > 0 && <Text style={[styles.sectionTitle, { marginBottom: spacing.sm }]}>Messages</Text>}
          </View>
        }
        ListEmptyComponent={
          newFollowers.length === 0 && filteredStartable.length === 0 ? (
            <EmptyState
              icon="chatbubbles-outline"
              title="No conversations yet"
              message="Follow people from the Discover tab to start chatting about what you're watching."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const isTyping = !!social.typingUserIds[item.user.id];
          const preview = isTyping ? 'typing…' : `${item.lastMessage?.sender === 'me' ? 'You: ' : ''}${item.lastMessage?.text ?? ''}`;
          return (
            <Pressable style={styles.chatRow} onPress={() => openConversation(item.user)}>
              <UserAvatar name={item.user.displayName} color={item.user.avatarColor} size={52} />
              <View style={{ flex: 1 }}>
                <View style={styles.chatRowTop}>
                  <Text style={styles.chatName} numberOfLines={1}>{item.user.displayName}</Text>
                  <Text style={styles.chatTime}>{item.lastMessage ? formatRelativeTime(item.lastMessage.createdAt) : ''}</Text>
                </View>
                <View style={styles.chatRowBottom}>
                  <Text numberOfLines={1} style={[styles.chatPreview, isTyping && styles.typingPreview]}>{preview}</Text>
                  {item.convo.unread > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{item.convo.unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  title: { color: colors.text, fontSize: fontSizes.xxl, fontWeight: '800' },
  peopleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
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
    marginBottom: spacing.lg,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: fontSizes.sm },
  listContent: { paddingBottom: spacing.xxl },
  section: { marginBottom: spacing.xl, paddingHorizontal: spacing.lg },
  sectionTitle: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md },
  followerCard: { alignItems: 'center', width: 78 },
  followerName: { color: colors.text, fontSize: fontSizes.xs, fontWeight: '700', marginTop: spacing.xs },
  followBackBadge: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  followBackText: { color: '#04120C', fontSize: 9, fontWeight: '800' },
  startCard: { alignItems: 'center', width: 66 },
  startName: { color: colors.text, fontSize: fontSizes.xs, fontWeight: '700', marginTop: spacing.xs },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2 },
  chatRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatName: { color: colors.text, fontSize: fontSizes.md, fontWeight: '700', flex: 1, marginRight: spacing.sm },
  chatTime: { color: colors.textFaint, fontSize: 11 },
  chatRowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  chatPreview: { color: colors.textDim, fontSize: fontSizes.sm, flex: 1, marginRight: spacing.sm },
  typingPreview: { color: colors.accent, fontStyle: 'italic' },
  unreadBadge: { backgroundColor: colors.accent, borderRadius: radius.pill, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText: { color: '#04120C', fontSize: 11, fontWeight: '800' },
});

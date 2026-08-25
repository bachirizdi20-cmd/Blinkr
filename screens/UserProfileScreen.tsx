import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import UserAvatar from '../components/UserAvatar';
import EmptyState from '../components/EmptyState';
import { ContentStackParamList } from '../navigation/types';
import { useSocial } from '../context/SocialContext';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type RouteT = RouteProp<ContentStackParamList, 'UserProfile'>;

export default function UserProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const social = useSocial();
  const user = social.getUser(route.params.userId);

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState icon="alert-circle-outline" title="User not found" />
      </SafeAreaView>
    );
  }

  const following = social.isFollowing(user.id);
  const followers = social.followerCountFor(user.id) + (user.followsYou ? 1 : 0);
  const followingCount = social.followingCountFor(user.id);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <UserAvatar name={user.displayName} color={user.avatarColor} size={100} />
        <View style={styles.nameBlock}>
          <Text style={styles.name}>{user.displayName}</Text>
          {user.followsYou && (
            <View style={styles.followsYouTag}>
              <Text style={styles.followsYouText}>Follows you</Text>
            </View>
          )}
        </View>
        <Text style={styles.username}>@{user.username}</Text>
        <Text style={styles.bio}>{user.bio}</Text>

        <View style={styles.genreTag}>
          <Ionicons name="film-outline" size={13} color={colors.accent} />
          <Text style={styles.genreText}>Loves {user.favoriteGenre}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{followers.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{followingCount.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actionBtn, following ? styles.followingBtn : styles.followBtn]}
            onPress={() => social.toggleFollow(user.id)}
          >
            <Ionicons name={following ? 'checkmark' : 'person-add'} size={16} color={following ? colors.text : '#04120C'} />
            <Text style={[styles.actionBtnText, following ? styles.followingBtnText : styles.followBtnText]}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.messageBtn]}
            onPress={() => navigation.navigate('Conversation', { userId: user.id })}
          >
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
});

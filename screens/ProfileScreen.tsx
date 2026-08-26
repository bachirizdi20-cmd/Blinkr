import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Switch, View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import SectionHeader from '../components/SectionHeader';
import RatingStars from '../components/RatingStars';
import EmptyState from '../components/EmptyState';
import PosterCard from '../components/PosterCard';
import { ContentStackParamList } from '../navigation/types';
import { useLibrary } from '../context/LibraryContext';
import { useSocial } from '../context/SocialContext';
import { posterUrl } from '../lib/tmdb';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import { useAuth } from '../hooks/use-auth';
import { AuthPanel } from '../components/AuthPanel';
import { trpc } from '../lib/trpc';
import { ProfileSkeleton, ReviewsSkeleton } from '../components/Skeleton';

type Nav = NativeStackNavigationProp<ContentStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { user, loading: authLoading, error: authError, logout, refresh } = useAuth();
  const syncedRef = useRef(false);
  const syncMutation = trpc.account.sync.useMutation();
  const privacyMutation = trpc.account.updatePrivacy.useMutation();
  const deleteMutation = trpc.account.delete.useMutation();
  const accountQuery = trpc.account.me.useQuery(undefined, { enabled: !!user, retry: false });
  const remoteReviewsQuery = trpc.reviews.mine.useQuery(undefined, { enabled: !!user, retry: false });
  const remoteLibraryQuery = trpc.library.mine.useQuery(undefined, { enabled: !!user, retry: false });
  const lib = useLibrary();
  const social = useSocial();
  const { profile, stats, diary, lists, likes } = lib;

  useEffect(() => {
    if (!user || !lib.loaded || !social.loaded || syncedRef.current) return;
    syncedRef.current = true;
    syncMutation.mutate({
      libraryJson: JSON.stringify({ watchlist: lib.watchlist, diary: lib.diary, lists: lib.lists, likes: lib.likes }),
      socialJson: JSON.stringify({ followingIds: social.followingIds, reviews: social.reviews, conversations: social.conversations }),
    });
  }, [user, lib.loaded, social.loaded]);

  if (authLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.authLoading}><ActivityIndicator size="large" color={colors.accent} /><Text style={styles.authLoadingText}>Checking your account...</Text></View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.authScreen}>
          <View style={styles.authIcon}><Ionicons name="person-circle-outline" size={54} color={colors.accent} /></View>
          <Text style={styles.authTitle}>Your movie space</Text>
          <Text style={styles.authBody}>Sign in to save your diary, build watchlists, follow friends, and keep your activity synced.</Text>
          {!!authError && <Text style={styles.authError}>We couldn't verify your session. Please try again.</Text>}
          <AuthPanel onAuthenticated={refresh} />
          <Text style={styles.authNote}>Your session is protected and synced across devices.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!lib.loaded || !social.loaded || accountQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false}><ProfileSkeleton /><View style={styles.skeletonReviews}><Text style={styles.skeletonTitle}>Your latest reviews</Text><ReviewsSkeleton /></View></ScrollView>
      </SafeAreaView>
    );
  }

  const initials = (user.name || profile.username).slice(0, 2).toUpperCase();
  const recentDiary = [...diary].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  const recentReviews = diary.filter((e) => !!e.review).sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
  const likeItems = Object.values(likes).sort((a, b) => b.likedAt - a.likedAt).slice(0, 8);

  const handlePrivacyChange = (isPrivate: boolean) => {
    lib.updateProfile({ isPrivate });
    privacyMutation.mutate({ isPrivate });
  };

  const handleDeleteAccount = () => {
    Alert.alert('Delete account?', 'This permanently removes your account data and cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteMutation.mutateAsync({ confirmation: 'DELETE MY ACCOUNT' });
          await logout();
        } catch (error) {
          Alert.alert('Could not delete account', 'Please try again.');
        }
      } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
                    {profile.avatarUri ? (
            <Image source={{ uri: profile.avatarUri }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, { backgroundColor: profile.avatarColor }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={styles.username}>{user.name || profile.username}</Text>
            <Text style={styles.bio} numberOfLines={2}>{profile.bio || user.email || 'Tell people what you love to watch.'}</Text>
          </View>
          <Pressable style={styles.editBtn} onPress={() => navigation.navigate('People')}>
            <Ionicons name="person-add-outline" size={16} color={colors.text} />
          </Pressable>
          <Pressable style={styles.editBtn} onPress={() => navigation.navigate('EditProfile')}>
            <Ionicons name="pencil" size={16} color={colors.text} />
          </Pressable>
          <Pressable style={styles.editBtn} onPress={() => logout()} accessibilityLabel="Sign out">
            <Ionicons name="log-out-outline" size={17} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.socialRow}>
          <Pressable style={styles.socialCard} onPress={() => navigation.navigate('People', { initialFilter: 'following' })}>
            <Text style={styles.socialValue}>{social.myFollowingCount}</Text>
            <Text style={styles.socialLabel}>Following</Text>
          </Pressable>
          <View style={styles.socialDivider} />
          <Pressable style={styles.socialCard} onPress={() => navigation.navigate('People', { initialFilter: 'followers' })}>
            <Text style={styles.socialValue}>{social.myFollowerCount}</Text>
            <Text style={styles.socialLabel}>Followers</Text>
          </Pressable>
          <View style={styles.socialDivider} />
          <Pressable style={styles.socialCard} onPress={() => navigation.getParent()?.navigate('Chats' as never)}>
            <Text style={styles.socialValue}>{social.totalUnread}</Text>
            <Text style={styles.socialLabel}>Unread Chats</Text>
          </Pressable>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Films" value={stats.filmsWatched} />
          <StatCard label="Shows" value={stats.showsWatched} />
          <StatCard label="This Year" value={stats.thisYear} />
          <StatCard label="Avg Rating" value={stats.avgRating ? stats.avgRating.toFixed(1) : '—'} />
        </View>

        <View style={styles.cloudStats}>
          <Text style={styles.cloudStatsTitle}>Synced across devices</Text>
          <View style={styles.cloudStatsRow}>
            <Text style={styles.cloudStatText}>{remoteReviewsQuery.data?.length ?? 0} cloud reviews</Text>
            <Text style={styles.cloudStatText}>{remoteLibraryQuery.data?.length ?? 0} library items</Text>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Diary" subtitle={`${diary.length} logged`} onSeeAll={() => navigation.navigate('Diary')} />
          {recentDiary.length === 0 ? (
            <EmptyState icon="book-outline" title="No entries yet" message="Log what you watch to build your diary." />
          ) : (
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
              {recentDiary.map((entry) => (
                <Pressable
                  key={entry.id}
                  style={styles.diaryRow}
                  onPress={() => navigation.navigate('Detail', { mediaType: entry.mediaType, id: entry.mediaId })}
                >
                  <Image source={{ uri: posterUrl(entry.posterPath, 'w200') ?? undefined }} style={styles.diaryPoster} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.diaryTitle} numberOfLines={1}>{entry.title}</Text>
                    <Text style={styles.diaryDate}>{entry.watchedDate}</Text>
                    {!!entry.rating && <RatingStars rating={entry.rating} size={13} />}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Reviews" subtitle={`${diary.filter((e) => !!e.review).length} written`} onSeeAll={() => navigation.navigate('Reviews')} />
          {recentReviews.length === 0 ? (
            <EmptyState icon="chatbox-ellipses-outline" title="No reviews yet" message="Share your thoughts when you log a title." />
          ) : (
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
              {recentReviews.map((entry) => (
                <Pressable
                  key={entry.id}
                  style={styles.reviewCard}
                  onPress={() => navigation.navigate('Detail', { mediaType: entry.mediaType, id: entry.mediaId })}
                >
                  <Text style={styles.reviewTitle} numberOfLines={1}>{entry.title}</Text>
                  {!!entry.rating && <RatingStars rating={entry.rating} size={13} />}
                  <Text style={styles.reviewBody} numberOfLines={3}>{entry.review}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Your Lists" subtitle={`${lists.length} lists`} onSeeAll={() => navigation.navigate('Lists')} />
          {lists.length === 0 ? (
            <EmptyState icon="list-outline" title="No lists yet" message="Create curated collections of your favorite titles." />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              {lists.slice(0, 8).map((list) => (
                <Pressable key={list.id} style={styles.listCard} onPress={() => navigation.navigate('ListDetail', { listId: list.id })}>
                  <View style={styles.listCoverRow}>
                    {list.items.slice(0, 3).map((it, idx) => (
                      <Image
                        key={idx}
                        source={{ uri: posterUrl(it.posterPath, 'w200') ?? undefined }}
                        style={[styles.listCoverPoster, { marginLeft: idx === 0 ? 0 : -24 }]}
                        contentFit="cover"
                      />
                    ))}
                    {list.items.length === 0 && (
                      <View style={[styles.listCoverPoster, styles.listCoverEmpty]}>
                        <Ionicons name="film-outline" size={20} color={colors.textFaint} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.listName} numberOfLines={1}>{list.name}</Text>
                  <Text style={styles.listCount}>{list.items.length} titles</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Favorites" subtitle={`${Object.keys(likes).length} saved`} onSeeAll={() => navigation.navigate('Likes')} />
          {likeItems.length === 0 ? (
            <EmptyState icon="heart-outline" title="No favorites yet" message="Tap the heart on a title to save it here." />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
              {likeItems.map((item) => (
                <View key={`${item.mediaType}-${item.mediaId}`} style={styles.favoriteItem}>
                  <PosterCard
                    item={{ id: item.mediaId, mediaType: item.mediaType, title: item.title, posterPath: item.posterPath, date: item.date, voteAverage: item.voteAverage }}
                    width={100}
                    onPress={() => navigation.navigate('Detail', { mediaType: item.mediaType, id: item.mediaId })}
                  />
                  <Pressable
                    accessibilityLabel={`Remove ${item.title} from favorites`}
                    style={styles.removeFavorite}
                    onPress={() => lib.toggleLike(item)}
                  >
                    <Ionicons name="heart" size={14} color={colors.bg} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.accountSettings}>
          <Text style={styles.settingsTitle}>Account & Privacy</Text>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Private activity</Text>
              <Text style={styles.settingHint}>Hide your reviews and lists from people who do not follow you.</Text>
            </View>
            <Switch value={!!profile.isPrivate} onValueChange={handlePrivacyChange} trackColor={{ false: colors.surfaceHigh, true: colors.accent }} thumbColor={colors.text} />
          </View>
          <Pressable style={styles.deleteButton} onPress={handleDeleteAccount} disabled={deleteMutation.isPending}>
            <Ionicons name="trash-outline" size={17} color={colors.danger} />
            <Text style={styles.deleteText}>{deleteMutation.isPending ? 'Deleting…' : 'Delete account'}</Text>
          </Pressable>
        </View>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  skeletonReviews: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  favoriteItem: { position: 'relative', width: 100 },
  removeFavorite: { position: 'absolute', top: 7, right: 7, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  skeletonTitle: { color: colors.textDim, fontSize: fontSizes.md, fontWeight: '800', marginBottom: spacing.md },
  cloudStats: { marginHorizontal: spacing.lg, marginTop: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  cloudStatsTitle: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '800', marginBottom: spacing.sm },
  cloudStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cloudStatText: { color: colors.textDim, fontSize: 12 },
  accountSettings: { marginHorizontal: spacing.lg, marginTop: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  settingsTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '800', marginBottom: spacing.md },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  settingLabel: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '700' },
  settingHint: { color: colors.textFaint, fontSize: 11, lineHeight: 16, marginTop: 3 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  deleteText: { color: colors.danger, fontSize: fontSizes.sm, fontWeight: '700' },
  authLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  authLoadingText: { color: colors.textDim, fontSize: fontSizes.sm },
  authScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  authIcon: { width: 94, height: 94, borderRadius: 47, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  authTitle: { color: colors.text, fontSize: fontSizes.xxl, fontWeight: '800', textAlign: 'center' },
  authBody: { color: colors.textDim, fontSize: fontSizes.md, lineHeight: 23, textAlign: 'center', marginTop: spacing.sm, maxWidth: 340 },
  authError: { color: colors.danger, fontSize: fontSizes.sm, textAlign: 'center', marginTop: spacing.md },
  authButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 50, width: '100%', maxWidth: 340, backgroundColor: colors.accent, borderRadius: radius.pill, marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  authButtonText: { color: colors.bg, fontSize: fontSizes.md, fontWeight: '800' },
  authNote: { color: colors.textFaint, fontSize: fontSizes.xs, marginTop: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#04120C', fontSize: fontSizes.xl, fontWeight: '800' },
  username: { color: colors.text, fontSize: fontSizes.xl, fontWeight: '800' },
  bio: { color: colors.textDim, fontSize: fontSizes.sm, marginTop: 2 },
  editBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
  },
  socialCard: { flex: 1, alignItems: 'center' },
  socialDivider: { width: 1, height: 28, backgroundColor: colors.border },
  socialValue: { color: colors.accent3, fontSize: fontSizes.lg, fontWeight: '800' },
  socialLabel: { color: colors.textFaint, fontSize: 10, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  statsGrid: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.xl },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.accent, fontSize: fontSizes.lg, fontWeight: '800' },
  statLabel: { color: colors.textFaint, fontSize: 10, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  section: { marginBottom: spacing.xl },
  diaryRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  diaryPoster: { width: 46, height: 66, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh },
  diaryTitle: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '700' },
  diaryDate: { color: colors.textFaint, fontSize: 11, marginTop: 2, marginBottom: 3 },
  reviewCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 4 },
  reviewTitle: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '700' },
  reviewBody: { color: colors.textDim, fontSize: fontSizes.sm, lineHeight: 19 },
  listCard: { width: 130 },
  listCoverRow: { flexDirection: 'row', marginBottom: spacing.xs },
  listCoverPoster: { width: 60, height: 88, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh, borderWidth: 2, borderColor: colors.bg },
  listCoverEmpty: { alignItems: 'center', justifyContent: 'center' },
  listName: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '700' },
  listCount: { color: colors.textFaint, fontSize: 11, marginTop: 1 },
});

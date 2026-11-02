import React, { useState } from 'react';
import { ActivityIndicator, Alert, Share, View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import RatingStars from '../components/RatingStars';
import EmptyState from '../components/EmptyState';
import PosterCard from '../components/PosterCard';
import { ContentStackParamList } from '../navigation/types';
import { useLibrary } from '../context/LibraryContext';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import { useAuth } from '../hooks/use-auth';
import { AuthPanel } from '../components/AuthPanel';
import { trpc } from '../lib/trpc';
import { ProfileSkeleton, ReviewsSkeleton } from '../components/Skeleton';
import { resolveMediaUrl } from '../lib/media-url';
import { clearAccountLibraryStorage } from '../lib/library-storage';

type Nav = NativeStackNavigationProp<ContentStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { user, loading: authLoading, error: authError, logout, refresh } = useAuth();
  const deleteMutation = trpc.account.delete.useMutation();
  const requestVerification = trpc.auth.requestVerification.useMutation();
  const accountQuery = trpc.account.me.useQuery(undefined, { enabled: !!user, retry: false });
  const remoteReviewsQuery = trpc.reviews.mine.useQuery(undefined, { enabled: !!user, retry: false });
  const remoteLibraryQuery = trpc.library.mine.useQuery(undefined, { enabled: !!user, retry: false });
  const lib = useLibrary();
  const { profile, stats, diary, lists, likes } = lib;
  const [menuVisible, setMenuVisible] = useState(false);

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

  if (!lib.loaded || accountQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false}><ProfileSkeleton /><View style={styles.skeletonReviews}><Text style={styles.skeletonTitle}>Your latest reviews</Text><ReviewsSkeleton /></View></ScrollView>
      </SafeAreaView>
    );
  }

  const remoteProfile = accountQuery.data?.data;
  const displayName = user.name || remoteProfile?.username || profile.username;
  const displayedUsername = remoteProfile?.username || profile.username || 'cinephile';
  const displayedBio = remoteProfile ? remoteProfile.bio : profile.bio;
  const displayedAvatar = remoteProfile ? remoteProfile.avatarUrl : profile.avatarUri;
  const initials = displayName.slice(0, 2).toUpperCase();
  const recentDiary = [...diary].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  const recentReviews = diary.filter((e) => !!e.review).sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
  const likeItems = Object.values(likes).sort((a, b) => b.likedAt - a.likedAt).slice(0, 8);

  const emailVerified = Boolean((accountQuery.data?.user as { emailVerifiedAt?: Date | null } | undefined)?.emailVerifiedAt);

  const handleRequestVerification = async () => {
    try {
      await requestVerification.mutateAsync();
      Alert.alert('Verification email sent', 'Check your inbox and follow the link to verify your email.');
    } catch {
      Alert.alert('Could not send email', 'Please try again later.');
    }
  };

  const handleDeleteAccount = () => {
    setMenuVisible(false);
    setTimeout(() => Alert.alert('حذف الحساب نهائيًا؟', 'سيؤدي هذا إلى حذف حسابك وبياناته، ولا يمكن التراجع عن ذلك.', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف الحساب', style: 'destructive', onPress: async () => {
        try {
          await deleteMutation.mutateAsync({ confirmation: 'DELETE MY ACCOUNT' });
          let localDataRemovalFailed = false;
          try {
            await clearAccountLibraryStorage(AsyncStorage, user.openId);
          } catch (error) {
            localDataRemovalFailed = true;
            console.error('[Account] Failed to clear local library after account deletion:', error);
          }
          await logout();
          if (localDataRemovalFailed) Alert.alert('تم حذف الحساب', 'تعذر مسح بعض البيانات المحلية. احذف بيانات التطبيق من إعدادات الهاتف قبل استخدامه مجددًا.');
        } catch {
          Alert.alert('تعذّر حذف الحساب', 'حاول مرة أخرى لاحقًا.');
        }
      } },
    ]), 150);
  };

  const confirmLogout = () => {
    setMenuVisible(false);
    setTimeout(() => Alert.alert('تسجيل الخروج؟', 'هل تريد تسجيل الخروج من Blinkr؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'تسجيل الخروج', style: 'destructive', onPress: () => void logout() },
    ]), 150);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.topNav}>
          <Pressable onPress={() => navigation.goBack()} style={styles.topNavButton} accessibilityLabel="رجوع"><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
          <Text style={styles.topNavTitle}>الملف الشخصي</Text>
          <Pressable onPress={() => setMenuVisible(true)} style={styles.topNavButton} accessibilityLabel="فتح قائمة الحساب"><Ionicons name="menu" size={25} color={colors.text} /></Pressable>
        </View>

        <View style={styles.profileHero}>
          <View style={styles.avatarColumn}>
            <Pressable onPress={() => navigation.navigate('EditProfile')} style={styles.avatarButton} accessibilityLabel="تغيير صورة الملف الشخصي">
              {resolveMediaUrl(displayedAvatar) ? <Image source={{ uri: resolveMediaUrl(displayedAvatar) }} style={styles.avatar} contentFit="cover" /> : <View style={[styles.avatar, { backgroundColor: profile.avatarColor }]}><Text style={styles.avatarText}>{initials}</Text></View>}
              <View style={styles.avatarCameraBadge}><Ionicons name="camera" size={13} color={colors.bg} /></View>
            </Pressable>
            <Text style={styles.avatarHint}>تغيير الصورة</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.username}>{displayName}</Text>
            <Text style={styles.handle}>@{displayedUsername}</Text>
            <View style={styles.profileActions}>
              <Pressable style={({ pressed }) => [styles.editButton, pressed && styles.pressed]} onPress={() => navigation.navigate('EditProfile')}><Text style={styles.editButtonText}>تعديل الملف</Text></Pressable>
              <Pressable style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]} onPress={() => Share.share({ message: `تابع ${displayName} على Blinkr.` })} accessibilityLabel="مشاركة الملف"><Ionicons name="share-outline" size={19} color={colors.text} /></Pressable>
            </View>
          </View>
        </View>
        <Text style={styles.bio} numberOfLines={3}>{displayedBio || 'أضف نبذة قصيرة عن ذوقك السينمائي.'}</Text>
        <View style={styles.metaRow}><Ionicons name="film-outline" size={17} color={colors.textDim} /><Text style={styles.metaText}>عالمك السينمائي</Text><Ionicons name="calendar-outline" size={17} color={colors.textDim} /><Text style={styles.metaText}>عضو في Blinkr</Text></View>

        <View style={styles.statsStrip}>
          <StatCard label="Films" value={stats.filmsWatched + stats.showsWatched} />
          <StatCard label="This year" value={stats.thisYear} />
          <StatCard label="Lists" value={lists.length} />
          <Pressable style={styles.statCard} onPress={() => navigation.navigate('People', { initialFilter: 'following' })}><Text style={styles.statValue}>{accountQuery.data?.socialStats.followingCount ?? 0}</Text><Text style={styles.statLabel}>Following</Text></Pressable>
          <Pressable style={styles.statCard} onPress={() => navigation.navigate('People', { initialFilter: 'followers' })}><Text style={styles.statValue}>{accountQuery.data?.socialStats.followerCount ?? 0}</Text><Text style={styles.statLabel}>Followers</Text></Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.profileTabs}>
          <ProfileTab icon="person-circle-outline" label="Profile" active />
          <ProfileTab icon="book-outline" label="Diary" onPress={() => navigation.navigate('Diary')} />
          <ProfileTab icon="list-outline" label="Lists" onPress={() => navigation.navigate('Lists')} />
          <ProfileTab icon="star-outline" label="Ratings" onPress={() => navigation.navigate('Reviews')} />
        </ScrollView>

        <View style={styles.section}><View style={styles.referenceSectionHeader}><Text style={styles.referenceSectionTitle}>Favorite films</Text><Pressable onPress={() => navigation.navigate('Likes')}><Text style={styles.viewAll}>View all</Text></Pressable></View>
          {likeItems.length === 0 ? <EmptyState icon="heart-outline" title="No favorites yet" message="Tap the heart on a title to save it here." /> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterRail}>{likeItems.slice(0, 8).map((item) => <View key={`${item.mediaType}-${item.mediaId}`} style={styles.favoriteItem}><PosterCard item={{ id: item.mediaId, mediaType: item.mediaType, title: item.title, posterPath: item.posterPath, date: item.date, voteAverage: item.voteAverage }} width={112} onPress={() => navigation.navigate('Detail', { mediaType: item.mediaType, id: item.mediaId })} /><Pressable accessibilityLabel={`Remove ${item.title} from favorites`} style={styles.removeFavorite} onPress={() => lib.toggleLike(item)}><Ionicons name="heart" size={14} color={colors.bg} /></Pressable></View>)}</ScrollView>}
        </View>

        <View style={styles.contentColumns}>
          <View style={styles.activityPanel}><View style={styles.panelHeader}><Text style={styles.panelTitle}>Activity</Text><Ionicons name="pulse-outline" size={18} color={colors.accent} /></View>{recentReviews.length === 0 ? <Text style={styles.emptyPanel}>Your ratings and reviews will appear here.</Text> : recentReviews.slice(0, 3).map((entry) => <Pressable key={entry.id} style={styles.activityRow} onPress={() => navigation.navigate('Detail', { mediaType: entry.mediaType, id: entry.mediaId })}><View style={styles.activityAvatar}><Text style={styles.activityInitial}>{initials.slice(0, 1)}</Text></View><View style={{ flex: 1 }}><Text style={styles.activityText}>{user.name || profile.username} rated</Text><Text style={styles.activityTitle} numberOfLines={1}>{entry.title}</Text>{!!entry.rating && <RatingStars rating={entry.rating} size={12} />}</View></Pressable>)}</View>
          <View style={styles.activityPanel}><View style={styles.panelHeader}><Text style={styles.panelTitle}>Diary</Text><Pressable onPress={() => navigation.navigate('Diary')}><Text style={styles.viewAll}>View all</Text></Pressable></View>{recentDiary.length === 0 ? <Text style={styles.emptyPanel}>Start logging what you watch.</Text> : recentDiary.slice(0, 3).map((entry) => <Pressable key={entry.id} style={styles.diaryRow} onPress={() => navigation.navigate('Detail', { mediaType: entry.mediaType, id: entry.mediaId })}><View style={styles.dateBadge}><Text style={styles.dateMonth}>{entry.watchedDate?.slice(0, 3) || 'LOG'}</Text><Text style={styles.dateDay}>{entry.watchedDate?.slice(-2) || '—'}</Text></View><View style={{ flex: 1 }}><Text style={styles.diaryTitle} numberOfLines={1}>{entry.title}</Text><Text style={styles.diaryDate}>{entry.watchedDate}</Text>{!!entry.rating && <RatingStars rating={entry.rating} size={12} />}</View></Pressable>)}</View>
        </View>

        <View style={styles.cloudStats}><Text style={styles.cloudStatsTitle}>Synced across devices</Text><View style={styles.cloudStatsRow}><Text style={styles.cloudStatText}>{remoteReviewsQuery.data?.length ?? 0} cloud reviews</Text><Text style={styles.cloudStatText}>{remoteLibraryQuery.data?.length ?? 0} library items</Text></View>{!emailVerified && user.email ? <Pressable onPress={handleRequestVerification} disabled={requestVerification.isPending} style={styles.verifyButton}><Ionicons name="mail-outline" size={15} color={colors.accent} /><Text style={styles.verifyText}>{requestVerification.isPending ? 'Sending...' : 'Verify your email'}</Text></Pressable> : null}</View>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.menuOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuVisible(false)} accessibilityLabel="إغلاق القائمة" />
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>الحساب والإعدادات</Text>
            <MenuItem icon="settings-outline" label="الإعدادات" onPress={() => { setMenuVisible(false); navigation.navigate('Settings'); }} />
            <MenuItem icon="person-outline" label="تعديل الملف الشخصي" onPress={() => { setMenuVisible(false); navigation.navigate('EditProfile'); }} />
            <MenuItem icon="notifications-outline" label="الإشعارات" onPress={() => { setMenuVisible(false); navigation.navigate('Notifications'); }} />
            <View style={styles.menuDivider} />
            <MenuItem icon="log-out-outline" label="تسجيل الخروج" onPress={confirmLogout} danger />
            <MenuItem icon="trash-outline" label={deleteMutation.isPending ? 'جارٍ حذف الحساب…' : 'حذف الحساب'} onPress={handleDeleteAccount} danger disabled={deleteMutation.isPending} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MenuItem({ icon, label, onPress, danger, disabled }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed, disabled && { opacity: 0.55 }]} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.text} />
      <Text style={[styles.menuItemText, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

function ProfileTab({ icon, label, active, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; active?: boolean; onPress?: () => void }) {
  return <Pressable onPress={onPress} style={[styles.profileTab, active && styles.profileTabActive]}><Ionicons name={icon} size={21} color={active ? colors.accent : colors.textDim} /><Text style={[styles.profileTabLabel, active && styles.profileTabLabelActive]}>{label}</Text></Pressable>;
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
  topNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  topNavButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  topNavTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '800' },
  profileHero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md },
  profileInfo: { flex: 1, gap: 4 },
  handle: { color: colors.textDim, fontSize: fontSizes.md },
  profileActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  editButton: { height: 42, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  editButtonText: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '800' },
  shareButton: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  metaText: { color: colors.textDim, fontSize: 12, marginRight: spacing.sm },
  statsStrip: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.lg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: spacing.md },
  profileTabs: { paddingHorizontal: spacing.md, gap: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.xl },
  profileTab: { minWidth: 86, alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  profileTabActive: { borderBottomColor: colors.accent },
  profileTabLabel: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  profileTabLabelActive: { color: colors.accent },
  referenceSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  referenceSectionTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '800' },
  viewAll: { color: colors.accent, fontSize: fontSizes.sm, fontWeight: '800' },
  posterRail: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  contentColumns: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  activityPanel: { flex: 1, minWidth: 0, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  panelTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '800' },
  emptyPanel: { color: colors.textDim, fontSize: 12, lineHeight: 18, padding: spacing.md },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  activityAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  activityInitial: { color: colors.bg, fontSize: 13, fontWeight: '900' },
  activityText: { color: colors.textDim, fontSize: 11 },
  activityTitle: { color: colors.text, fontSize: 13, fontWeight: '800', marginVertical: 2 },
  dateBadge: { width: 46, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  dateMonth: { color: colors.textDim, fontSize: 10, fontWeight: '800' },
  dateDay: { color: colors.text, fontSize: 17, fontWeight: '800' },
  skeletonReviews: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  favoriteItem: { position: 'relative', width: 100 },
  removeFavorite: { position: 'absolute', top: 7, right: 7, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  skeletonTitle: { color: colors.textDim, fontSize: fontSizes.md, fontWeight: '800', marginBottom: spacing.md },
  cloudStats: { marginHorizontal: spacing.lg, marginTop: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  cloudStatsTitle: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '800', marginBottom: spacing.sm },
  cloudStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  verifyButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, alignSelf: 'flex-start' as const },
  verifyText: { color: colors.accent, fontSize: fontSizes.xs, fontWeight: '800' as const },
  cloudStatText: { color: colors.textDim, fontSize: 12 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'flex-end', paddingTop: 62, paddingHorizontal: spacing.md },
  menuCard: { width: 280, backgroundColor: colors.bgElevated, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, elevation: 12 },
  menuTitle: { color: colors.textDim, fontSize: fontSizes.xs, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl', paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.md },
  menuItemPressed: { backgroundColor: colors.surfaceHigh },
  menuItemText: { flex: 1, color: colors.text, fontSize: fontSizes.sm, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  menuDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs, marginHorizontal: spacing.md },
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
  avatarColumn: { alignItems: 'center', gap: 4 },
  avatarButton: { position: 'relative' },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarCameraBadge: { position: 'absolute', right: -2, bottom: -2, width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.bg },
  avatarHint: { color: colors.accent, fontSize: 9, fontWeight: '700' },
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

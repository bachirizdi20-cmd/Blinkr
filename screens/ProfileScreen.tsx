import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Share, View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import EmptyState from '../components/EmptyState';
import { ContentStackParamList } from '../navigation/types';
import { useLibrary } from '../context/LibraryContext';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import { useAuth } from '../hooks/use-auth';
import { AuthPanel } from '../components/AuthPanel';
import { trpc } from '../lib/trpc';
import { ProfileSkeleton, ReviewsSkeleton } from '../components/Skeleton';
import { resolveMediaUrl } from '../lib/media-url';
import { clearAccountLibraryStorage } from '../lib/library-storage';
import { ProfileBio, ProfileIdentity } from '../components/ProfileIdentity';
import { ProfileStatsGrid } from '../components/ProfileStatsGrid';
import { ProfileMediaGrid } from '../components/ProfileMediaGrid';
import { ProfileFavoriteRail } from '../components/ProfileFavoriteRail';
import { animateProfileTabChange, ProfileSectionTabs, ProfileSectionTab } from '../components/ProfileSectionTabs';
import { mergeProfileMediaItems } from '../lib/profile-media';
import { catalogPosterUrl, normalizeReviewMediaType, openCatalogItem } from '../lib/catalog-navigation';
import { PlatformAlert as Alert } from '../lib/platform-alert';

type Nav = NativeStackNavigationProp<ContentStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { user, loading: authLoading, error: authError, logout, refresh } = useAuth();
  const deleteMutation = trpc.account.delete.useMutation();
  const requestVerification = trpc.auth.requestVerification.useMutation();
  const librarySyncMutation = trpc.account.sync.useMutation();
  const accountQuery = trpc.account.me.useQuery(undefined, { enabled: !!user, retry: false });
  const remoteReviewsQuery = trpc.reviews.mine.useQuery(undefined, { enabled: !!user, retry: false });
  const remoteStatusesQuery = trpc.library.mine.useQuery(undefined, { enabled: !!user, retry: false });
  const lib = useLibrary();
  const { profile, diary, likes } = lib;
  const [menuVisible, setMenuVisible] = useState(false);
  const [librarySyncError, setLibrarySyncError] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileSectionTab>('reviews');
  const handleProfileTabChange = (tab: ProfileSectionTab) => {
    if (tab !== activeTab) animateProfileTabChange();
    setActiveTab(tab);
  };

  useEffect(() => {
    if (!user || !lib.loaded || accountQuery.isLoading || accountQuery.isError) return;
    const libraryJson = JSON.stringify({
      watchlist: lib.watchlist,
      likes: lib.likes,
      diary: lib.diary,
      lists: lib.lists,
      profile: lib.profile,
      episodeWatched: lib.episodeWatched,
    });
    if (libraryJson.length > 1_900_000) { setLibrarySyncError(true); return; }
    if (libraryJson === accountQuery.data?.data?.libraryJson) { setLibrarySyncError(false); return; }
    const timer = setTimeout(() => {
      void librarySyncMutation.mutateAsync({ libraryJson, socialJson: accountQuery.data?.data?.socialJson ?? '{}' })
        .then(() => setLibrarySyncError(false))
        .catch((error) => { setLibrarySyncError(true); console.warn('Unable to sync public profile library', error); });
    }, 650);
    return () => clearTimeout(timer);
  }, [user?.id, lib.loaded, lib.watchlist, lib.likes, lib.diary, lib.lists, lib.profile, lib.episodeWatched, accountQuery.data?.data?.libraryJson, accountQuery.data?.data?.socialJson, accountQuery.isLoading, accountQuery.isError]);

  if (authLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.authLoading}><ActivityIndicator size="large" color={colors.accent} /><Text style={styles.authLoadingText}>جارٍ التحقق من حسابك…</Text></View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.authScreen}>
          <View style={styles.authIcon}><Ionicons name="person-circle-outline" size={54} color={colors.accent} /></View>
          <Text style={styles.authTitle}>مساحتك في Blinkr</Text>
          <Text style={styles.authBody}>سجّل الدخول لحفظ يومياتك وقوائم المشاهدة ومتابعة أصدقائك ومزامنة نشاطك.</Text>
          {!!authError && <Text style={styles.authError}>تعذّر التحقق من جلستك. حاول مرة أخرى.</Text>}
          <AuthPanel onAuthenticated={refresh} />
          <Text style={styles.authNote}>جلستك محمية ويمكن مزامنتها عبر أجهزتك.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!lib.loaded || accountQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false}><ProfileSkeleton /><View style={styles.skeletonReviews}><Text style={styles.skeletonTitle}>أحدث مراجعاتك</Text><ReviewsSkeleton /></View></ScrollView>
      </SafeAreaView>
    );
  }

  const remoteProfile = accountQuery.data?.data;
  const displayName = user.name || 'مستخدم Blinkr';
  const displayedBio = remoteProfile ? remoteProfile.bio : profile.bio;
  const displayedAvatar = remoteProfile ? remoteProfile.avatarUrl : profile.avatarUri;
  const initials = displayName.slice(0, 2).toUpperCase();
  const publishedReviews = remoteReviewsQuery.data ?? [];
  const likeItems = Object.values(likes).sort((a, b) => b.likedAt - a.likedAt).slice(0, 5);
  const savedItems = mergeProfileMediaItems(Object.values(lib.watchlist), remoteStatusesQuery.data ?? [], ['watchlist', 'watching']);
  const completedItems = mergeProfileMediaItems(diary, remoteStatusesQuery.data ?? [], ['watched']);
  const emailVerified = Boolean((accountQuery.data?.user as { emailVerifiedAt?: Date | null } | undefined)?.emailVerifiedAt);

  const handleRequestVerification = async () => {
    try {
      await requestVerification.mutateAsync();
      Alert.alert('تم إرسال رسالة التحقق', 'افتح بريدك الإلكتروني واتبع الرابط لتأكيده.');
    } catch {
      Alert.alert('تعذر إرسال الرسالة', 'حاول مرة أخرى لاحقًا.');
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
      <View style={styles.topNav}>
        <Pressable onPress={() => navigation.goBack()} style={styles.topNavButton} accessibilityLabel="رجوع"><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
        <Text style={styles.topNavTitle}>الملف الشخصي</Text>
        <Pressable onPress={() => setMenuVisible(true)} style={styles.topNavButton} accessibilityLabel="فتح قائمة الحساب"><Ionicons name="menu" size={25} color={colors.text} /></Pressable>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.profileScrollContent}>
        <View style={styles.commonProfileContent}>
        <ProfileIdentity
          name={displayName}
          avatar={(
            <Pressable onPress={() => navigation.navigate('EditProfile')} style={styles.avatarButton} accessibilityLabel="تغيير صورة الملف الشخصي">
              {resolveMediaUrl(displayedAvatar) ? <Image source={{ uri: resolveMediaUrl(displayedAvatar) }} style={styles.avatar} contentFit="cover" /> : <View style={[styles.avatar, { backgroundColor: profile.avatarColor }]}><Text style={styles.avatarText}>{initials}</Text></View>}
              <View style={styles.avatarCameraBadge}><Ionicons name="camera-outline" size={10} color={colors.accent} /></View>
            </Pressable>
          )}
          stats={(
            <ProfileStatsGrid
              compact
              followers={accountQuery.data?.socialStats.followerCount ?? null}
              following={accountQuery.data?.socialStats.followingCount ?? null}
              reviews={remoteReviewsQuery.isLoading || remoteReviewsQuery.isError ? null : publishedReviews.length}
              followingLabel="أتابعهم"
              onFollowersPress={() => navigation.navigate('People', { initialFilter: 'followers' })}
              onFollowingPress={() => navigation.navigate('People', { initialFilter: 'following' })}
              onReviewsPress={() => handleProfileTabChange('reviews')}
            />
          )}
        />
        <View style={styles.identityActions}>
          <Pressable style={({ pressed }) => [styles.identityAction, styles.identityPrimary, pressed && styles.pressed]} onPress={() => navigation.navigate('EditProfile')}><Ionicons name="create-outline" size={15} color={colors.accent} /><Text style={styles.identityPrimaryText}>تعديل الملف</Text></Pressable>
          <Pressable style={({ pressed }) => [styles.identityAction, styles.identitySecondary, pressed && styles.pressed]} onPress={() => Share.share({ message: `تابع ${displayName} على Blinkr.` })} accessibilityLabel="مشاركة الملف"><Ionicons name="share-outline" size={17} color={colors.text} /><Text style={styles.identitySecondaryText}>مشاركة الرابط</Text></Pressable>
        </View>
        <ProfileBio bio={displayedBio} fallback="أضف نبذة قصيرة عن ذوقك في الأفلام والكتب." />

        <View style={styles.section}>
          <View style={styles.referenceSectionHeader}><Text style={styles.referenceSectionTitle}>المفضلات</Text></View>
          <ProfileFavoriteRail
            items={likeItems}
            onOpen={(item) => openCatalogItem(navigation, item)}
            onAddFavorite={() => navigation.navigate('Search', { mediaOnly: true })}
            horizontalPadding={0}
            availableWidthPadding={spacing.lg}
          />
        </View>

        <ProfileSectionTabs activeTab={activeTab} onChange={handleProfileTabChange} />
        </View>

        <View style={styles.tabBody}>
          {activeTab === 'reviews' ? (
            <View style={styles.publishedReviewsSection}>
              {remoteReviewsQuery.isLoading ? <View style={styles.publishedReviewsState}><ActivityIndicator color={colors.accent} /><Text style={styles.publishedReviewsHint}>جارٍ تحميل المراجعات…</Text></View> : remoteReviewsQuery.isError ? (
                <View style={styles.publishedReviewsEmpty}><Text style={styles.publishedReviewsHint}>تعذر تحميل المراجعات.</Text><Pressable onPress={() => void remoteReviewsQuery.refetch()}><Text style={styles.verifyText}>إعادة المحاولة</Text></Pressable></View>
              ) : publishedReviews.length === 0 ? (
                <EmptyState icon="chatbox-ellipses-outline" title="لا توجد مراجعات منشورة بعد" message="ستظهر هنا المراجعات التي تنشرها." />
              ) : publishedReviews.map((review) => {
                const mediaType = normalizeReviewMediaType(review.mediaType);
                const poster = catalogPosterUrl(mediaType, review.posterPath, 'w200');
                return (
                  <Pressable key={review.id} style={styles.publishedReviewCard} onPress={() => openCatalogItem(navigation, { mediaType, mediaId: review.mediaId, title: review.title, posterPath: review.posterPath })}>
                    {poster ? <Image source={{ uri: poster }} style={styles.publishedReviewPoster} contentFit="cover" /> : <View style={[styles.publishedReviewPoster, styles.publishedPosterFallback]}><Ionicons name={mediaType === 'book' ? 'book-outline' : 'film-outline'} size={22} color={colors.textFaint} /></View>}
                    <View style={styles.publishedReviewInfo}>
                      <Text style={styles.publishedReviewTitle} numberOfLines={2}>{review.title}</Text>
                      {review.rating != null ? <View style={styles.publishedRating}><Ionicons name="star" size={12} color={colors.gold} /><Text style={styles.publishedRatingText}>{review.rating}/10</Text></View> : null}
                      <Text style={styles.publishedReviewDate}>{formatProfileDate(review.updatedAt)}</Text>
                      <Text style={styles.publishedReviewBody} numberOfLines={3}>{review.review || 'قيّمت هذا العنوان دون إضافة تعليق مكتوب.'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {activeTab === 'saved' ? (
            <View style={styles.profileContentSection}>
              <ProfileMediaGrid items={savedItems} onOpen={(item) => openCatalogItem(navigation, item)} emptyTitle="لا توجد عناوين محفوظة" emptyMessage="أضف فيلمًا أو مسلسلًا أو كتابًا للعودة إليه لاحقًا." />
            </View>
          ) : null}

          {activeTab === 'completed' ? (
            <View style={styles.profileContentSection}>
              <ProfileMediaGrid items={completedItems} onOpen={(item) => openCatalogItem(navigation, item)} emptyIcon="checkmark-circle-outline" emptyTitle="لا يوجد سجل مكتمل بعد" emptyMessage="سجّل فيلمًا أو مسلسلًا أو كتابًا بعد مشاهدته أو قراءته." />
            </View>
          ) : null}
        </View>

        {(accountQuery.isError || librarySyncError || (!emailVerified && Boolean(accountQuery.data) && Boolean(user.email))) ? (
          <View style={styles.accountNotice}>
            {accountQuery.isError ? <View><Text style={styles.syncErrorText}>تعذر تحميل بعض أعداد الحساب؛ ما زالت بياناتك المحلية ظاهرة.</Text><Pressable onPress={() => void accountQuery.refetch()}><Text style={styles.verifyText}>إعادة المحاولة</Text></Pressable></View> : null}
            {librarySyncError ? <Text style={styles.syncErrorText}>تعذرت مزامنة المحفوظات واليوميات والقوائم مع ملفك العام.</Text> : null}
            {!emailVerified && accountQuery.data && user.email ? <Pressable onPress={handleRequestVerification} disabled={requestVerification.isPending} style={styles.verifyButton}><Ionicons name="mail-outline" size={15} color={colors.accent} /><Text style={styles.verifyText}>{requestVerification.isPending ? 'جارٍ الإرسال…' : 'تحقق من بريدك الإلكتروني'}</Text></Pressable> : null}
          </View>
        ) : null}
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

function formatProfileDate(value: Date | string | number | null | undefined) {
  if (value == null) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric' });
}

function MenuItem({ icon, label, onPress, danger, disabled }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed, disabled && { opacity: 0.55 }]} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.text} />
      <Text style={[styles.menuItemText, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  topNavButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  topNavTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '800' },
  profileScrollContent: { paddingBottom: spacing.xl },
  commonProfileContent: { paddingHorizontal: spacing.lg },
  identityActions: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xs },
  identityAction: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  identityPrimary: { backgroundColor: 'rgba(51,214,166,0.10)', borderColor: 'rgba(51,214,166,0.44)' },
  identityPrimaryText: { color: colors.accent, fontSize: fontSizes.xs, fontWeight: '800' },
  identitySecondary: { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  identitySecondaryText: { color: colors.text, fontSize: fontSizes.xs, fontWeight: '800' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  section: { marginTop: spacing.sm, marginBottom: 0 },
  referenceSectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.sm },
  referenceSectionTitle: { color: colors.text, fontSize: fontSizes.lg, lineHeight: 24, fontWeight: '800', textAlign: 'right' },
  favoriteEmpty: { paddingHorizontal: spacing.lg },
  skeletonReviews: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  skeletonTitle: { color: colors.textDim, fontSize: fontSizes.md, fontWeight: '800', marginBottom: spacing.md },
  tabBody: { paddingBottom: spacing.sm },
  profileContentSection: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  accountNotice: { marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, gap: spacing.xs },
  syncErrorText: { color: colors.danger, fontSize: fontSizes.xs, marginTop: spacing.sm, textAlign: 'right' },
  verifyButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, alignSelf: 'flex-start' as const },
  verifyText: { color: colors.accent, fontSize: fontSizes.xs, fontWeight: '800' as const },
  publishedReviewsSection: { marginBottom: spacing.xl, paddingHorizontal: spacing.lg },
  publishedReviewCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  publishedReviewPoster: { width: 58, height: 82, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh },
  publishedPosterFallback: { alignItems: 'center', justifyContent: 'center' },
  publishedReviewInfo: { flex: 1, alignItems: 'flex-end', gap: 5 },
  publishedReviewTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '800', textAlign: 'right' },
  publishedRating: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceHigh, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  publishedRatingText: { color: colors.text, fontSize: fontSizes.xs, fontWeight: '800' },
  publishedReviewDate: { color: colors.textDim, fontSize: 11, lineHeight: 16 },
  publishedReviewBody: { color: colors.textDim, fontSize: fontSizes.xs, lineHeight: 18, textAlign: 'right', alignSelf: 'stretch' },
  publishedReviewsState: { minHeight: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  publishedReviewsEmpty: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  publishedReviewsHint: { color: colors.textDim, fontSize: fontSizes.sm, textAlign: 'center' },
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
  avatarButton: { position: 'relative' },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surfaceHigh },
  avatarCameraBadge: { position: 'absolute', right: 0, bottom: 0, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh, borderWidth: 2, borderColor: colors.bg },
  avatarText: { color: '#04120C', fontSize: fontSizes.lg, fontWeight: '800' },
});

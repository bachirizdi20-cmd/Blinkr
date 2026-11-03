import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Share, View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import RatingStars from '../components/RatingStars';
import EmptyState from '../components/EmptyState';
import ApiErrorState from '../components/ApiErrorState';
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
import { ProfileIdentity } from '../components/ProfileIdentity';
import { ProfileStatsGrid } from '../components/ProfileStatsGrid';
import { ProfileTopReviews } from '../components/ProfileTopReviews';
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
  const remoteLibraryQuery = trpc.library.mine.useQuery(undefined, { enabled: !!user, retry: false });
  const lib = useLibrary();
  const { profile, diary, lists, likes } = lib;
  const [menuVisible, setMenuVisible] = useState(false);
  const [librarySyncError, setLibrarySyncError] = useState(false);

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

  if (accountQuery.isError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ApiErrorState message="تعذر تحميل معلومات حسابك." onRetry={() => void accountQuery.refetch()} />
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
  const publishedReviews = remoteReviewsQuery.data ?? [];
  const ratedReviews = publishedReviews.filter((review) => review.rating != null);
  const topReviews = [...ratedReviews]
    .sort((a, b) => Number(b.rating) - Number(a.rating) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)
    .map((review) => ({ ...review, mediaType: normalizeReviewMediaType(review.mediaType) }));
  const latestPublishedReviews = [...publishedReviews].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 3);
  const joinedDate = formatProfileDate(accountQuery.data?.user.createdAt ?? profile.joinedAt);
  const likeItems = Object.values(likes).sort((a, b) => b.likedAt - a.likedAt).slice(0, 5);

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
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.commonProfileContent}>
        <ProfileIdentity
          name={displayName}
          username={displayedUsername}
          bio={displayedBio}
          joinedAt={joinedDate}
          bioFallback="أضف نبذة قصيرة عن ذوقك السينمائي."
          avatar={(
            <Pressable onPress={() => navigation.navigate('EditProfile')} style={styles.avatarButton} accessibilityLabel="تغيير صورة الملف الشخصي">
              {resolveMediaUrl(displayedAvatar) ? <Image source={{ uri: resolveMediaUrl(displayedAvatar) }} style={styles.avatar} contentFit="cover" /> : <View style={[styles.avatar, { backgroundColor: profile.avatarColor }]}><Text style={styles.avatarText}>{initials}</Text></View>}
              <View style={styles.avatarCameraBadge}><Ionicons name="camera" size={13} color={colors.bg} /></View>
            </Pressable>
          )}
          actions={(
            <>
              <Pressable style={({ pressed }) => [styles.identityAction, styles.identityPrimary, pressed && styles.pressed]} onPress={() => navigation.navigate('EditProfile')}><Text style={styles.identityPrimaryText}>تعديل الملف</Text></Pressable>
              <Pressable style={({ pressed }) => [styles.identityAction, styles.identitySecondary, pressed && styles.pressed]} onPress={() => Share.share({ message: `تابع ${displayName} على Blinkr.` })} accessibilityLabel="مشاركة الملف"><Ionicons name="share-outline" size={17} color={colors.text} /><Text style={styles.identitySecondaryText}>مشاركة</Text></Pressable>
            </>
          )}
        />

        <ProfileStatsGrid
          followers={accountQuery.data?.socialStats.followerCount ?? 0}
          following={accountQuery.data?.socialStats.followingCount ?? 0}
          followingLabel="أتابعهم"
          onFollowersPress={() => navigation.navigate('People', { initialFilter: 'followers' })}
          onFollowingPress={() => navigation.navigate('People', { initialFilter: 'following' })}
        />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.profileTabs}>
          <ProfileTab icon="person-circle-outline" label="الملف" active />
          <ProfileTab icon="book-outline" label="اليوميات" onPress={() => navigation.navigate('Diary')} />
          <ProfileTab icon="list-outline" label="القوائم" onPress={() => navigation.navigate('Lists')} />
          <ProfileTab icon="star-outline" label="التقييمات" onPress={() => navigation.navigate('Reviews')} />
        </ScrollView>

        <View style={styles.section}><View style={styles.referenceSectionHeader}><View><Text style={styles.referenceSectionTitle}>مفضلاتك</Text><Text style={styles.sectionHeadingSubtitle}>خمسة عناوين تعبّر عن ذوقك</Text></View><Pressable onPress={() => navigation.navigate('Likes')}><Text style={styles.viewAll}>عرض الكل</Text></Pressable></View>
          {likeItems.length === 0 ? <EmptyState icon="heart-outline" title="لا توجد مفضلات بعد" message="اضغط على القلب في أي عنوان لإضافته هنا." /> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterRail}>{likeItems.map((item) => <View key={`${item.mediaType}-${item.mediaId}`} style={styles.favoriteItem}><PosterCard item={{ id: item.mediaId, mediaType: item.mediaType, title: item.title, posterPath: item.posterPath, date: item.date, voteAverage: item.voteAverage }} width={112} onPress={() => openCatalogItem(navigation, item)} /><Pressable accessibilityLabel={`إزالة ${item.title} من المفضلة`} style={styles.removeFavorite} onPress={() => lib.toggleLike(item)}><Ionicons name="heart" size={14} color={colors.bg} /></Pressable></View>)}</ScrollView>}
        </View>

        <ProfileTopReviews
          items={topReviews}
          loading={remoteReviewsQuery.isLoading}
          error={remoteReviewsQuery.isError}
          onRetry={() => void remoteReviewsQuery.refetch()}
          onOpen={(mediaType, id) => openCatalogItem(navigation, { mediaType, mediaId: id })}
          subtitle="أبرز اختياراتك من المراجعات المنشورة"
        />

        <View style={[styles.publishedReviewsSection, { paddingHorizontal: spacing.lg }]}>
          <View style={styles.sectionHeading}>
            <View><Text style={styles.sectionHeadingTitle}>أحدث المراجعات</Text><Text style={styles.sectionHeadingSubtitle}>آراؤك المنشورة في الأفلام والمسلسلات والكتب</Text></View>
            <Ionicons name="film-outline" size={21} color={colors.accent} />
          </View>
          {remoteReviewsQuery.isLoading ? <View style={styles.publishedReviewsState}><ActivityIndicator color={colors.accent} /><Text style={styles.publishedReviewsHint}>جارٍ تحميل المراجعات…</Text></View> : remoteReviewsQuery.isError ? (
            <View style={styles.publishedReviewsEmpty}><Text style={styles.publishedReviewsHint}>تعذر تحميل المراجعات.</Text><Pressable onPress={() => void remoteReviewsQuery.refetch()}><Text style={styles.verifyText}>إعادة المحاولة</Text></Pressable></View>
          ) : latestPublishedReviews.length === 0 ? (
            <View style={styles.publishedReviewsEmpty}><Text style={styles.publishedReviewsHint}>ستظهر هنا المراجعات التي تنشرها.</Text></View>
          ) : latestPublishedReviews.map((review) => {
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

        <View style={styles.contentColumns}>
          <View style={styles.activityPanel}><View style={styles.panelHeader}><Text style={styles.panelTitle}>النشاط</Text><Ionicons name="pulse-outline" size={18} color={colors.accent} /></View>{recentReviews.length === 0 ? <Text style={styles.emptyPanel}>ستظهر تقييماتك ومراجعاتك هنا.</Text> : recentReviews.slice(0, 3).map((entry) => <Pressable key={entry.id} style={styles.activityRow} onPress={() => openCatalogItem(navigation, entry)}><View style={styles.activityAvatar}><Text style={styles.activityInitial}>{initials.slice(0, 1)}</Text></View><View style={{ flex: 1 }}><Text style={styles.activityText}>{user.name || profile.username} قيّم</Text><Text style={styles.activityTitle} numberOfLines={1}>{entry.title}</Text>{!!entry.rating && <RatingStars rating={entry.rating} size={12} />}</View></Pressable>)}</View>
          <View style={styles.activityPanel}><View style={styles.panelHeader}><Text style={styles.panelTitle}>اليوميات</Text><Pressable onPress={() => navigation.navigate('Diary')}><Text style={styles.viewAll}>عرض الكل</Text></Pressable></View>{recentDiary.length === 0 ? <Text style={styles.emptyPanel}>ابدأ بتسجيل ما تشاهده.</Text> : recentDiary.slice(0, 3).map((entry) => <Pressable key={entry.id} style={styles.diaryRow} onPress={() => openCatalogItem(navigation, entry)}><View style={styles.dateBadge}><Text style={styles.dateMonth}>{entry.watchedDate?.slice(0, 3) || 'سجل'}</Text><Text style={styles.dateDay}>{entry.watchedDate?.slice(-2) || '—'}</Text></View><View style={{ flex: 1 }}><Text style={styles.diaryTitle} numberOfLines={1}>{entry.title}</Text><Text style={styles.diaryDate}>{entry.watchedDate}</Text>{!!entry.rating && <RatingStars rating={entry.rating} size={12} />}</View></Pressable>)}</View>
        </View>

        <View style={styles.cloudStats}><Text style={styles.cloudStatsTitle}>مزامنة بياناتك</Text><View style={styles.cloudStatsRow}><Text style={styles.cloudStatText}>{publishedReviews.length} مراجعة سحابية</Text>{remoteLibraryQuery.isError ? <Pressable onPress={() => void remoteLibraryQuery.refetch()}><Text style={styles.verifyText}>تعذر تحميل المكتبة — إعادة المحاولة</Text></Pressable> : <Text style={styles.cloudStatText}>{remoteLibraryQuery.isLoading ? 'جارٍ تحميل المكتبة…' : `${remoteLibraryQuery.data?.length ?? 0} عنصر في المكتبة`}</Text>}</View>{librarySyncError ? <Text style={styles.syncErrorText}>تعذرت مزامنة اليوميات والقوائم والمفضلة إلى ملفك العام.</Text> : null}{!emailVerified && user.email ? <Pressable onPress={handleRequestVerification} disabled={requestVerification.isPending} style={styles.verifyButton}><Ionicons name="mail-outline" size={15} color={colors.accent} /><Text style={styles.verifyText}>{requestVerification.isPending ? 'جارٍ الإرسال…' : 'تحقق من بريدك الإلكتروني'}</Text></Pressable> : null}</View>
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

function ProfileTab({ icon, label, active, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; active?: boolean; onPress?: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: !!active }} style={[styles.profileTab, active && styles.profileTabActive]}><Ionicons name={icon} size={21} color={active ? colors.accent : colors.textDim} /><Text style={[styles.profileTabLabel, active && styles.profileTabLabelActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  topNavButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  topNavTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '800' },
  commonProfileContent: { paddingHorizontal: spacing.lg },
  identityAction: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: spacing.md, borderRadius: radius.md },
  identityPrimary: { backgroundColor: colors.accent },
  identityPrimaryText: { color: '#04120C', fontSize: fontSizes.xs, fontWeight: '800' },
  identitySecondary: { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  identitySecondaryText: { color: colors.text, fontSize: fontSizes.xs, fontWeight: '800' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
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
  syncErrorText: { color: colors.danger, fontSize: fontSizes.xs, marginTop: spacing.sm, textAlign: 'right' },
  verifyButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, alignSelf: 'flex-start' as const },
  verifyText: { color: colors.accent, fontSize: fontSizes.xs, fontWeight: '800' as const },
  cloudStatText: { color: colors.textDim, fontSize: 12 },
  publishedReviewsSection: { marginBottom: spacing.xl },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sectionHeadingTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '800', textAlign: 'right' },
  sectionHeadingSubtitle: { color: colors.textFaint, fontSize: fontSizes.xs, marginTop: 3, textAlign: 'right' },
  publishedReviewCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  publishedReviewPoster: { width: 58, height: 82, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh },
  publishedPosterFallback: { alignItems: 'center', justifyContent: 'center' },
  publishedReviewInfo: { flex: 1, alignItems: 'flex-end', gap: 5 },
  publishedReviewTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '800', textAlign: 'right' },
  publishedRating: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceHigh, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  publishedRatingText: { color: colors.text, fontSize: fontSizes.xs, fontWeight: '800' },
  publishedReviewDate: { color: colors.textFaint, fontSize: 10 },
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
  avatar: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center' },
  avatarCameraBadge: { position: 'absolute', right: -2, bottom: -2, width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.bg },
  avatarText: { color: '#04120C', fontSize: fontSizes.xl, fontWeight: '800' },
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

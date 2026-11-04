import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import UserAvatar from '../components/UserAvatar';
import EmptyState from '../components/EmptyState';
import ApiErrorState from '../components/ApiErrorState';
import { ContentStackParamList } from '../navigation/types';
import { trpc } from '../lib/trpc';
import { catalogPosterUrl, normalizeReviewMediaType, openCatalogItem } from '../lib/catalog-navigation';
import { ReviewMediaType } from '../types/tmdb';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import { ProfileBio, ProfileIdentity } from '../components/ProfileIdentity';
import { ProfileStatsGrid } from '../components/ProfileStatsGrid';
import { ProfileFavoriteRail } from '../components/ProfileFavoriteRail';
import { ProfileMediaGrid } from '../components/ProfileMediaGrid';
import { animateProfileTabChange, ProfileSectionTabs, ProfileSectionTab } from '../components/ProfileSectionTabs';
import { ProfileMediaItem, ProfileMediaStatus, mergeProfileMediaItems } from '../lib/profile-media';
import { PlatformAlert as Alert } from '../lib/platform-alert';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type RouteT = RouteProp<ContentStackParamList, 'UserProfile'>;

export default function UserProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const routeUserId = route.params.userId;
  const rawId = routeUserId.replace(/^remote-/, '');
  const numericId = Number(rawId);

  if (/^\d+$/.test(rawId) && Number.isSafeInteger(numericId) && numericId > 0) {
    return (
      <RemoteUserProfile
        userId={numericId}
        onBack={() => navigation.goBack()}
        onMessage={() => navigation.navigate('Conversation', { userId: `remote-${numericId}` })}
        onOpenMedia={(mediaType, mediaId) => openCatalogItem(navigation, { mediaType, mediaId })}
      />
    );
  }

  return (
    <ProfileState onBack={() => navigation.goBack()}>
      <EmptyState icon="alert-circle-outline" title="الملف غير متاح" message="لم نتمكن من العثور على هذا المستخدم." />
    </ProfileState>
  );
}

function ProfileState({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} accessibilityLabel="رجوع"><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
        <Text style={styles.headerTitle}>الملف الشخصي</Text>
        <View style={{ width: 24 }} />
      </View>
      {children}
    </SafeAreaView>
  );
}

function RemoteUserProfile({
  userId,
  onBack,
  onMessage,
  onOpenMedia,
}: {
  userId: number;
  onBack: () => void;
  onMessage: () => void;
  onOpenMedia: (mediaType: ReviewMediaType, mediaId: number) => void;
}) {
  const profileQuery = trpc.social.profile.useQuery({ userId });
  const reviewsQuery = trpc.social.userReviews.useQuery({ userId }, { enabled: Boolean(profileQuery.data) });
  const publicLibraryQuery = trpc.social.userLibrary.useQuery({ userId }, { enabled: Boolean(profileQuery.data) });
  const mediaStatusesQuery = trpc.social.userMediaStatuses.useQuery({ userId }, { enabled: Boolean(profileQuery.data) });
  const followMutation = trpc.social.toggleFollow.useMutation({
    onSuccess: () => { void profileQuery.refetch(); },
    onError: () => Alert.alert('تعذرت المتابعة', 'تحقق من اتصالك ثم حاول مرة أخرى.'),
  });
  const blockMutation = trpc.social.block.useMutation({
    onSuccess: () => { Alert.alert('تم حظر المستخدم', 'لن تظهر لكما ملفات أو محتويات بعضكما.'); onBack(); },
    onError: () => Alert.alert('تعذر حظر المستخدم', 'حاول مرة أخرى لاحقًا.'),
  });
  const reportMutation = trpc.social.report.useMutation({
    onSuccess: (result) => {
      const duplicate = 'duplicate' in result && result.duplicate;
      Alert.alert(duplicate ? 'سبق الإبلاغ' : 'تم إرسال البلاغ', duplicate ? 'سبق أن أرسلت بلاغًا عن هذا المستخدم.' : 'شكرًا، سيراجع فريق Blinkr البلاغ.');
    },
    onError: () => Alert.alert('تعذر إرسال البلاغ', 'حاول مرة أخرى لاحقًا.'),
  });
  const likeMutation = trpc.social.toggleLike.useMutation({
    onSuccess: () => { void reviewsQuery.refetch(); },
    onError: () => Alert.alert('تعذر تسجيل الإعجاب', 'حاول مرة أخرى لاحقًا.'),
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState<ProfileSectionTab>('reviews');
  const handleProfileTabChange = (tab: ProfileSectionTab) => {
    if (tab !== activeTab) animateProfileTabChange();
    setActiveTab(tab);
  };
  const rawPublicLibrary = publicLibraryQuery.data ?? { likes: [], watchlist: [], diary: [], lists: [] };
  const mediaStatuses = (mediaStatusesQuery.data ?? []) as ProfileMediaStatus[];
  const publicLibrary = useMemo(() => ({
    ...rawPublicLibrary,
    watchlist: mergeProfileMediaItems(rawPublicLibrary.watchlist, mediaStatuses, ['watchlist', 'watching']),
    diary: mergeProfileMediaItems(rawPublicLibrary.diary, mediaStatuses, ['watched']),
  }), [rawPublicLibrary, mediaStatuses]);

  const confirmBlock = () => {
    setMenuOpen(false);
    Alert.alert('حظر هذا المستخدم؟', 'لن تتمكنا من متابعة بعضكما أو مراسلة بعضكما، ولن ترى محتوى هذا المستخدم.', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حظر', style: 'destructive', onPress: () => blockMutation.mutate({ userId }) },
    ]);
  };

  const confirmReport = () => {
    setMenuOpen(false);
    Alert.alert('الإبلاغ عن المستخدم', 'اختر سبب الإبلاغ:', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'رسائل مزعجة', onPress: () => reportMutation.mutate({ targetType: 'user', targetId: userId, reason: 'spam' }) },
      { text: 'مضايقة', onPress: () => reportMutation.mutate({ targetType: 'user', targetId: userId, reason: 'harassment' }) },
      { text: 'سبب آخر', onPress: () => reportMutation.mutate({ targetType: 'user', targetId: userId, reason: 'other' }) },
    ]);
  };

  if (profileQuery.isLoading) {
    return <ProfileState onBack={onBack}><View style={styles.loading}><ActivityIndicator size="large" color={colors.accent} /><Text style={styles.loadingText}>جارٍ تحميل الملف الشخصي…</Text></View></ProfileState>;
  }

  if (profileQuery.isError) {
    return <ProfileState onBack={onBack}><ApiErrorState message="تعذر تحميل الملف الشخصي." onRetry={() => profileQuery.refetch()} /></ProfileState>;
  }

  const profile = profileQuery.data;
  if (!profile) {
    return <ProfileState onBack={onBack}><EmptyState icon="person-remove-outline" title="الملف غير متاح" message="قد يكون المستخدم حذف حسابه أو حظرك." /></ProfileState>;
  }

  const displayName = profile.name?.trim() || 'مستخدم Blinkr';
  const favoriteItems = rawPublicLibrary.likes.slice(0, 5);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} accessibilityLabel="رجوع"><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
        <Text style={styles.headerTitle}>الملف الشخصي</Text>
        {!profile.isSelf ? <Pressable onPress={() => setMenuOpen((open) => !open)} hitSlop={8} accessibilityLabel="خيارات المستخدم"><Ionicons name="ellipsis-horizontal" size={22} color={colors.text} /></Pressable> : <View style={{ width: 24 }} />}
      </View>

      {menuOpen && !profile.isSelf ? (
        <View style={styles.menuOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} accessibilityLabel="إغلاق القائمة" />
          <View style={styles.menuCard}>
            <Pressable style={styles.menuItem} onPress={confirmReport}><Ionicons name="flag-outline" size={17} color={colors.text} /><Text style={styles.menuText}>الإبلاغ عن المستخدم</Text></Pressable>
            <Pressable style={styles.menuItem} onPress={confirmBlock}><Ionicons name="ban-outline" size={17} color={colors.danger} /><Text style={[styles.menuText, styles.dangerText]}>حظر المستخدم</Text></Pressable>
          </View>
        </View>
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ProfileStatsGrid
          followers={profile.followerCount ?? 0}
          following={profile.followingCount ?? 0}
          reviews={profile.reviewCount ?? 0}
          onReviewsPress={() => handleProfileTabChange('reviews')}
        />
        <ProfileIdentity
          name={displayName}
          avatar={<UserAvatar name={displayName} color={colors.accent} size={76} imageUrl={profile.avatarUrl ?? undefined} />}
          badge={profile.followsYou ? <View style={styles.followsYouTag}><Text style={styles.followsYouText}>يتابعك</Text></View> : undefined}
          actions={profile.isSelf ? <Text style={styles.selfLabel}>هذا ملفك الشخصي</Text> : (
            <>
              <Pressable
                style={[styles.actionButton, profile.isFollowing ? styles.secondaryButton : styles.primaryButton]}
                disabled={followMutation.isPending}
                onPress={() => followMutation.mutate({ userId })}
                accessibilityRole="button"
              >
                <Ionicons name={profile.isFollowing ? 'checkmark' : 'person-add-outline'} size={16} color={profile.isFollowing ? colors.text : '#04120C'} />
                <Text style={[styles.actionText, profile.isFollowing ? styles.secondaryButtonText : styles.primaryButtonText]}>
                  {profile.isFollowing ? 'تتابعه' : 'متابعة'}
                </Text>
              </Pressable>
              <Pressable style={[styles.actionButton, styles.secondaryButton, styles.shareIconButton]} onPress={() => void Share.share({ message: `تابع ${displayName} على Blinkr.` })} accessibilityRole="button" accessibilityLabel="مشاركة الملف">
                <Ionicons name="share-outline" size={16} color={colors.text} />
              </Pressable>
              <Pressable style={[styles.actionButton, styles.secondaryButton]} onPress={onMessage} accessibilityRole="button">
                <Ionicons name="chatbubble-outline" size={16} color={colors.text} />
                <Text style={[styles.actionText, styles.secondaryButtonText]}>الدردشة</Text>
              </Pressable>
            </>
          )}
        />

        <ProfileBio bio={profile.bio} fallback="لم يضف هذا المستخدم نبذة شخصية بعد." />

        <View style={styles.favoritesSection}>
          <View style={styles.favoritesHeader}><Text style={styles.sectionTitle}>المفضلات</Text></View>
          {publicLibraryQuery.isLoading ? <View style={styles.reviewLoading}><ActivityIndicator color={colors.accent} /><Text style={styles.loadingText}>جارٍ تحميل المفضلات…</Text></View> : publicLibraryQuery.isError ? (
            <View style={styles.inlineError}><Text style={styles.emptyText}>تعذر تحميل المفضلات.</Text><Pressable onPress={() => void publicLibraryQuery.refetch()}><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable></View>
          ) : favoriteItems.length ? (
            <ProfileFavoriteRail items={favoriteItems} onOpen={(item) => onOpenMedia(item.mediaType, item.mediaId)} horizontalPadding={0} availableWidthPadding={spacing.lg} />
          ) : <Text style={styles.emptyText}>لم يضف هذا المستخدم مفضلات بعد.</Text>}
        </View>

        <ProfileSectionTabs activeTab={activeTab} onChange={handleProfileTabChange} />

        {activeTab === 'reviews' ? (
          <View>
            {reviewsQuery.isLoading ? (
              <View style={styles.reviewLoading}><ActivityIndicator color={colors.accent} /><Text style={styles.loadingText}>جارٍ تحميل المراجعات…</Text></View>
            ) : reviewsQuery.isError ? (
              <View style={styles.inlineError}><Text style={styles.emptyText}>تعذر تحميل المراجعات.</Text><Pressable onPress={() => void reviewsQuery.refetch()}><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable></View>
            ) : !reviewsQuery.data?.length ? (
              <View style={styles.emptyReviews}><Ionicons name="chatbox-ellipses-outline" size={26} color={colors.textFaint} /><Text style={styles.emptyTitle}>لا توجد مراجعات بعد</Text><Text style={styles.emptyText}>ستظهر هنا المراجعات التي ينشرها هذا المستخدم.</Text></View>
            ) : (
              <View style={styles.reviewsList}>
                {reviewsQuery.data.map((item) => {
                  const review = item.review;
                  const mediaType = normalizeReviewMediaType(review.mediaType);
                  const poster = catalogPosterUrl(mediaType, review.posterPath, 'w200');
                  const reviewDate = formatArabicDate(review.updatedAt);
                  const spoilerVisible = !review.spoiler || revealedSpoilers[review.id];
                  return (
                    <View key={review.id} style={styles.reviewCard}>
                      <Pressable style={styles.reviewTop} onPress={() => onOpenMedia(mediaType, review.mediaId)} accessibilityRole="button">
                        {poster ? <Image source={{ uri: poster }} style={styles.poster} contentFit="cover" /> : <View style={[styles.poster, styles.posterFallback]}><Ionicons name={mediaType === 'book' ? 'book-outline' : 'film-outline'} size={25} color={colors.textFaint} /></View>}
                        <View style={styles.reviewInfo}><Text style={styles.reviewTitle} numberOfLines={2}>{review.title}</Text><View style={styles.ratingPill}><Ionicons name="star" size={13} color={colors.gold} /><Text style={styles.ratingText}>{review.rating}/10</Text></View>{reviewDate ? <Text style={styles.reviewDate}>{reviewDate}</Text> : null}</View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                      </Pressable>
                      {review.spoiler && !spoilerVisible ? (
                        <Pressable style={styles.spoilerNotice} onPress={() => setRevealedSpoilers((current) => ({ ...current, [review.id]: true }))}><Ionicons name="warning-outline" size={15} color={colors.gold} /><Text style={styles.spoilerText}>تحتوي المراجعة على حرق — اضغط لإظهارها</Text></Pressable>
                      ) : review.review ? <Text style={styles.reviewBody} numberOfLines={5}>{review.review}</Text> : <Text style={styles.reviewBodyMuted}>قيّم هذا العنوان دون إضافة تعليق مكتوب.</Text>}
                      <View style={styles.reviewFooter}><Text style={styles.reviewMeta}>{item.commentCount.toLocaleString('ar')} تعليق</Text><Pressable style={styles.likeButton} disabled={likeMutation.isPending} onPress={() => likeMutation.mutate({ reviewId: review.id })} accessibilityRole="button" accessibilityLabel={item.likedByMe ? 'إلغاء الإعجاب بالمراجعة' : 'أعجبني'}><Ionicons name={item.likedByMe ? 'heart' : 'heart-outline'} size={17} color={item.likedByMe ? colors.danger : colors.textDim} /><Text style={styles.reviewMeta}>{item.likeCount.toLocaleString('ar')}</Text></Pressable></View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : (
          <PublicMediaSection
            tab={activeTab}
            library={publicLibrary}
            loading={publicLibraryQuery.isLoading}
            error={publicLibraryQuery.isError}
            onRetry={() => { void publicLibraryQuery.refetch(); void mediaStatusesQuery.refetch(); }}
            onOpen={onOpenMedia}
          />
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

type PublicMediaItem = ProfileMediaItem & {
  status?: string;
  updatedAt?: Date | string;
  rating?: number | null;
  review?: string;
  watchedDate?: string | null;
};

type PublicUserLibrary = {
  likes: PublicMediaItem[];
  watchlist: PublicMediaItem[];
  diary: PublicMediaItem[];
};

function PublicMediaSection({
  tab,
  library,
  loading,
  error,
  onRetry,
  onOpen,
}: {
  tab: Exclude<ProfileSectionTab, 'reviews'>;
  library: PublicUserLibrary;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpen: (mediaType: ReviewMediaType, mediaId: number) => void;
}) {
  if (loading) return <View style={styles.reviewLoading}><ActivityIndicator color={colors.accent} /><Text style={styles.loadingText}>جارٍ تحميل مكتبة المشاهدة…</Text></View>;
  if (error) return <View style={styles.inlineError}><Text style={styles.emptyText}>تعذر تحميل مكتبة المشاهدة.</Text><Pressable onPress={onRetry}><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable></View>;

  const onOpenItem = (mediaType: ReviewMediaType, mediaId: number) => onOpen(mediaType, mediaId);
  const saved = tab === 'saved';
  const items = saved ? library.watchlist : library.diary;
  return (
    <View style={styles.publicMediaSection}>
      <ProfileMediaGrid
        items={items}
        onOpen={onOpenItem}
        emptyIcon={saved ? 'bookmark-outline' : 'checkmark-circle-outline'}
        emptyTitle={saved ? 'لا توجد عناوين محفوظة' : 'لا يوجد سجل مكتمل بعد'}
        emptyMessage={saved ? 'ستظهر هنا العناوين التي يحفظها هذا المستخدم.' : 'ستظهر هنا العناوين التي يسجلها بعد مشاهدتها أو قراءتها.'}
      />
    </View>
  );
}

function formatArabicDate(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '800' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  favoritesSection: { marginTop: spacing.xs, marginBottom: spacing.md },
  favoritesHeader: { marginBottom: spacing.sm, alignItems: 'flex-end' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { color: colors.textDim, fontSize: fontSizes.sm },
  followsYouTag: { backgroundColor: colors.surfaceHigh, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  followsYouText: { color: colors.textDim, fontSize: 10, fontWeight: '700' },
  selfLabel: { color: colors.textDim, fontSize: fontSizes.xs, fontWeight: '700', marginTop: spacing.xs, textAlign: 'right' },
  actionButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  shareIconButton: { width: 38, paddingHorizontal: 0 },
  primaryButton: { backgroundColor: colors.accent },
  secondaryButton: { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  actionText: { fontSize: fontSizes.xs, fontWeight: '800' },
  primaryButtonText: { color: '#04120C' },
  secondaryButtonText: { color: colors.text },
  sectionTitle: { color: colors.text, fontSize: fontSizes.lg, lineHeight: 24, fontWeight: '800', textAlign: 'right' },
  publicMediaSection: { marginBottom: spacing.xl },
  reviewLoading: { minHeight: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  inlineError: { alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg },
  retryText: { color: colors.accent, fontSize: fontSizes.sm, fontWeight: '800' },
  emptyReviews: { alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '800' },
  emptyText: { color: colors.textDim, fontSize: fontSizes.sm, textAlign: 'center' },
  reviewsList: { gap: spacing.md },
  reviewCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  reviewTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  poster: { width: 58, height: 82, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  reviewInfo: { flex: 1, alignItems: 'flex-end', gap: 5 },
  reviewTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '800', textAlign: 'right' },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceHigh, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  ratingText: { color: colors.text, fontSize: fontSizes.xs, fontWeight: '800' },
  reviewDate: { color: colors.textDim, fontSize: 11, lineHeight: 16 },
  reviewBody: { color: colors.textDim, fontSize: fontSizes.sm, lineHeight: 21, textAlign: 'right', marginTop: spacing.md },
  reviewBodyMuted: { color: colors.textDim, fontSize: 12, lineHeight: 18, textAlign: 'right', marginTop: spacing.md },
  spoilerNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, padding: spacing.md, marginTop: spacing.md, backgroundColor: colors.surfaceHigh, borderRadius: radius.sm },
  spoilerText: { color: colors.gold, fontSize: fontSizes.xs, fontWeight: '700', textAlign: 'right' },
  reviewFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  reviewMeta: { color: colors.textDim, fontSize: 12, lineHeight: 17 },
  likeButton: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 5 },
  menuOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, elevation: 20 },
  menuCard: { position: 'absolute', top: 52, right: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 4, elevation: 8, minWidth: 190 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 11 },
  menuText: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '700' },
  dangerText: { color: colors.danger },
});

import React, { useMemo } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ContentStackParamList } from '../navigation/types';
import { ComicSummary } from '../types/comics';
import { trpc } from '../lib/trpc';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import ComicCard from '../components/ComicCard';
import ApiErrorState from '../components/ApiErrorState';
import DetailActionBar from '../components/DetailActionBar';
import { useAuth } from '../hooks/use-auth';
import { useLibrary } from '../context/LibraryContext';
import { PlatformAlert as Alert } from '../lib/platform-alert';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type RouteT = RouteProp<ContentStackParamList, 'ComicDetail'>;

export default function ComicDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { id, comic: fallback } = route.params;
  const { user } = useAuth();
  const lib = useLibrary();
  const detailQuery = trpc.comics.detail.useQuery({ id }, { retry: 1 });
  const comic = (detailQuery.data ?? fallback) as ComicSummary | undefined;
  const statusQuery = trpc.library.getStatus.useQuery({ mediaType: 'comic', mediaId: id }, { enabled: Boolean(user), retry: false });
  const setStatusMutation = trpc.library.setStatus.useMutation();
  const removeStatusMutation = trpc.library.removeStatus.useMutation();
  const myReviewQuery = trpc.reviews.getMine.useQuery({ mediaType: 'comic', mediaId: id }, { enabled: Boolean(user), retry: false });
  const similarQuery = trpc.comics.similar.useQuery({ id, title: comic?.title ?? '', publisher: comic?.publisher ?? null, limit: 8 }, { enabled: Boolean(comic), retry: 1 });
  const info = useMemo(() => [comic?.issueNumber ? `العدد ${comic.issueNumber}` : null, comic?.publishDate, comic?.publisher].filter(Boolean), [comic]);

  if (detailQuery.isLoading && !comic) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /><Text style={styles.muted}>جارٍ تحميل الكوميك…</Text></View>;
  if (detailQuery.isError && !comic) return <View style={styles.safe}><ApiErrorState message="تعذر تحميل تفاصيل الكوميك من Comic Vine." onRetry={() => void detailQuery.refetch()} /></View>;
  if (!comic) return null;

  const mediaRef = { mediaType: 'comic' as const, mediaId: id, title: comic.title, posterPath: comic.coverUrl, date: comic.publishDate ?? undefined };
  const completed = lib.isWatched('comic', id) || statusQuery.data?.status === 'watched';
  const inList = lib.isInWatchlist('comic', id) || statusQuery.data?.status === 'watchlist';
  const rating = lib.getLatestRating('comic', id) ?? myReviewQuery.data?.rating ?? 0;
  const requireSignIn = () => Alert.alert('يلزم تسجيل الدخول', 'سجّل الدخول لحفظ حالة القراءة والمراجعة.', [{ text: 'حسنًا' }]);
  const syncStatus = async (status: 'watched' | 'watchlist' | null) => {
    if (!user) { requireSignIn(); return; }
    if (status) await setStatusMutation.mutateAsync({ ...mediaRef, status });
    else await removeStatusMutation.mutateAsync({ mediaType: 'comic', mediaId: id });
    await statusQuery.refetch();
  };

  return <View style={styles.safe}><View style={styles.topBar}><Pressable onPress={() => navigation.goBack()} style={styles.iconButton}><Ionicons name="chevron-back" size={22} color={colors.text} /></Pressable><Text style={styles.topTitle}>تفاصيل الكوميك</Text><View style={styles.iconButton} /></View><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.hero}><View style={styles.coverFrame}>{comic.coverUrl ? <Image source={{ uri: comic.coverUrl }} style={styles.cover} contentFit="cover" /> : <View style={[styles.cover, styles.fallback]}><Ionicons name="color-wand-outline" size={42} color={colors.textFaint} /></View>}</View><View style={styles.heroCopy}><Text style={styles.title}>{comic.title}</Text>{comic.volumeName ? <Text style={styles.volume}>{comic.volumeName}</Text> : null}{comic.creators.length ? <View style={styles.creatorRow}>{comic.creators.map((creator) => <Pressable key={creator} onPress={() => navigation.navigate('ComicCreator', { creatorName: creator, excludeId: id })}><Text style={styles.creators}>{creator}</Text></Pressable>)}</View> : null}{info.map((line) => <Text key={line} style={styles.meta}>{line}</Text>)}{comic.rating != null ? <Text style={styles.rating}>★ {comic.rating.toFixed(1)}</Text> : null}</View></View>
    <DetailActionBar completed={completed} inList={inList} completionLabel="تمت قراءته" listLabel="قائمة القراءة" onReview={() => navigation.navigate('ReviewModal', { mediaType: 'comic', mediaId: id, title: comic.title, posterPath: comic.coverUrl })} onToggleList={() => void syncStatus(inList ? null : 'watchlist')} onToggleCompleted={() => { lib.toggleWatchedQuick(mediaRef); void syncStatus(completed ? null : 'watched'); }} rating={rating} onRatingChange={(value) => lib.setQuickRating(mediaRef, value)} />
    {comic.description || comic.deck ? <View style={styles.section}><Text style={styles.sectionTitle}>عن الكوميك</Text><Text style={styles.description}>{comic.description ?? comic.deck}</Text></View> : null}
    <Pressable onPress={() => Linking.openURL(comic.sourceUrl)} style={styles.source}><Text style={styles.sourceText}>عرض المصدر على Comic Vine</Text><Ionicons name="open-outline" size={15} color={colors.accent} /></Pressable>
    <View style={styles.section}><Text style={styles.sectionTitle}>كوميك مشابهة</Text>{similarQuery.isLoading ? <ActivityIndicator color={colors.accent} /> : similarQuery.isError ? <Text style={styles.muted}>تعذر تحميل الكوميك المشابهة.</Text> : (similarQuery.data ?? []).length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarList}>{(similarQuery.data ?? []).filter((item) => Boolean(item.coverUrl)).map((item) => <ComicCard key={item.id} comic={item} width={112} onPress={() => navigation.push('ComicDetail', { id: item.id, comic: item })} />)}</ScrollView> : <Text style={styles.muted}>لا توجد كوميك مشابهة بأغلفة متاحة حاليًا.</Text>}</View>
  </ScrollView></View>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg }, topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }, topTitle: { flex: 1, textAlign: 'center', color: colors.text, fontSize: fontSizes.md, fontWeight: '800' }, iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 }, hero: { flexDirection: 'row', gap: spacing.md }, coverFrame: { width: 132, height: 194, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface }, cover: { width: '100%', height: '100%' }, fallback: { alignItems: 'center', justifyContent: 'center' }, heroCopy: { flex: 1, gap: spacing.sm }, title: { color: colors.text, fontSize: fontSizes.xl, lineHeight: 28, fontWeight: '900' }, volume: { color: colors.accent, fontSize: fontSizes.md, fontWeight: '700' }, creatorRow: { gap: 4 }, creators: { color: colors.accent, fontSize: fontSizes.sm, fontWeight: '700' }, meta: { color: colors.textDim, fontSize: fontSizes.sm }, rating: { color: colors.gold, fontSize: fontSizes.sm, fontWeight: '800' }, section: { marginTop: spacing.xl }, sectionTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '900', marginBottom: spacing.sm }, description: { color: colors.textDim, fontSize: fontSizes.md, lineHeight: 24 }, source: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: spacing.xl }, sourceText: { color: colors.accent, fontSize: fontSizes.sm, fontWeight: '800' }, similarList: { gap: spacing.md, paddingRight: spacing.sm }, muted: { color: colors.textFaint, fontSize: fontSizes.sm }, center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: spacing.sm } });

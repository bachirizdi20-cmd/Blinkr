import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import CastRow from '../components/CastRow';
import SectionRow from '../components/SectionRow';
import GenreChips from '../components/GenreChips';
import RatingStars from '../components/RatingStars';
import LoadingView from '../components/LoadingView';
import EmptyState from '../components/EmptyState';
import ApiErrorState from '../components/ApiErrorState';
import { ContentStackParamList } from '../navigation/types';
import { fetchDetail, posterUrl, backdropUrl, profileUrl } from '../lib/tmdb';
import { DetailResult } from '../types/tmdb';
import { useLibrary, mediaKey } from '../context/LibraryContext';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type RouteT = RouteProp<ContentStackParamList, 'Detail'>;

const { width, height } = Dimensions.get('window');
const BACKDROP_HEIGHT = height * 0.36;

function formatReviewDate(value: string) {
  if (!value) return 'TMDB review';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'TMDB review' : date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function formatRuntime(mins: number | null) {
  if (!mins) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function DetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { mediaType, id } = route.params;
  const lib = useLibrary();

  const [detail, setDetail] = useState<DetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDetail(mediaType, id);
      setDetail(data);
    } catch (err) {
      console.warn(err);
      setError(err instanceof Error ? err.message : 'Unable to load this title right now.');
    } finally {
      setLoading(false);
    }
  }, [mediaType, id]);

  useEffect(() => {
    load();
  }, [load]);

  const key = mediaKey(mediaType, id);
  const inWatchlist = lib.isInWatchlist(mediaType, id);
  const liked = lib.isLiked(mediaType, id);
  const watched = lib.isWatched(mediaType, id);
  const userRating = lib.getLatestRating(mediaType, id) ?? 0;
  const diaryEntries = lib.getDiaryForMedia(mediaType, id);

  const mediaRef = useMemo(
    () =>
      detail
        ? {
            mediaType,
            mediaId: id,
            title: detail.title,
            posterPath: detail.posterPath,
            date: detail.date,
            genreIds: detail.genreIds,
            voteAverage: detail.voteAverage,
          }
        : null,
    [detail, mediaType, id]
  );

  if (loading) return <LoadingView />;
  if (error || !detail) {
    return (
      <View style={styles.stateScreen}>
        <SafeAreaView edges={['top']} style={styles.stateTopBar}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        </SafeAreaView>
        <ApiErrorState message={error ?? 'This title is unavailable.'} onRetry={load} />
      </View>
    );
  }

  const trailer = detail.videos.find((v) => v.type === 'Trailer') ?? detail.videos[0];
  const director = detail.crew.find((c) => c.job === 'Director' || c.job === 'Creator');
  const year = detail.date ? detail.date.slice(0, 4) : '—';
  const runtimeLabel =
    mediaType === 'movie'
      ? formatRuntime(detail.runtimeMinutes)
      : `${detail.numberOfSeasons} Season${detail.numberOfSeasons !== 1 ? 's' : ''}`;

  const handleRate = (rating: number) => {
    if (!mediaRef) return;
    lib.setQuickRating(mediaRef, rating);
  };

  const handleToggleWatched = () => {
    if (!mediaRef) return;
    lib.toggleWatchedQuick(mediaRef);
  };

  const handleDeleteEntry = (entryId: string) => {
    Alert.alert('Delete log entry', 'Remove this diary entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => lib.deleteDiaryEntry(entryId) },
    ]);
  };

  const backdrop = backdropUrl(detail.backdropPath, 'w1280');
  const poster = posterUrl(detail.posterPath, 'w342');

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        <View style={{ height: BACKDROP_HEIGHT, backgroundColor: colors.surface }}>
          {backdrop && <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} contentFit="cover" />}
          <LinearGradient colors={['rgba(6,8,11,0.3)', 'transparent', colors.bg]} style={StyleSheet.absoluteFill} />
          <SafeAreaView edges={['top']} style={styles.topBar}>
            <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            {detail.isAnime && (
              <View style={styles.animeTag}>
                <Text style={styles.animeTagText}>ANIME</Text>
              </View>
            )}
          </SafeAreaView>
        </View>

        <View style={styles.headerRow}>
          <View style={styles.posterWrap}>
            {poster ? (
              <Image source={{ uri: poster }} style={styles.poster} contentFit="cover" />
            ) : (
              <View style={[styles.poster, styles.posterFallback]}>
                <Ionicons name="film-outline" size={30} color={colors.textFaint} />
              </View>
            )}
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.title} numberOfLines={3}>{detail.title}</Text>
            <Text style={styles.metaLine}>
              {year}{runtimeLabel ? `  •  ${runtimeLabel}` : ''}{'  •  '}{mediaType === 'movie' ? 'Movie' : 'TV Series'}
            </Text>
            <View style={styles.tmdbRow}>
              <Ionicons name="star" size={14} color={colors.gold} />
              <Text style={styles.tmdbScore}>{detail.voteAverage.toFixed(1)}</Text>
              <Text style={styles.tmdbLabel}>TMDB ({detail.voteCount.toLocaleString()})</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <GenreChips names={detail.genres.map((g) => g.name)} />

          {!!detail.tagline && <Text style={styles.tagline}>"{detail.tagline}"</Text>}

          <View style={styles.actionsCard}>
            <View style={styles.ratingSection}>
              <Text style={styles.ratingLabel}>Your Rating</Text>
              <RatingStars rating={userRating} size={26} interactive onChange={handleRate} />
            </View>
            <View style={styles.actionsRow}>
              <Pressable style={styles.actionBtn} onPress={handleToggleWatched}>
                <Ionicons name={watched ? 'checkmark-circle' : 'checkmark-circle-outline'} size={24} color={watched ? colors.accent : colors.text} />
                <Text style={[styles.actionLabel, watched && { color: colors.accent }]}>Watched</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={() => mediaRef && lib.toggleWatchlist(mediaRef)}>
                <Ionicons name={inWatchlist ? 'bookmark' : 'bookmark-outline'} size={24} color={inWatchlist ? colors.accent3 : colors.text} />
                <Text style={[styles.actionLabel, inWatchlist && { color: colors.accent3 }]}>Watchlist</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={() => mediaRef && lib.toggleLike(mediaRef)}>
                <Ionicons name={liked ? 'heart' : 'heart-outline'} size={24} color={liked ? colors.danger : colors.text} />
                <Text style={[styles.actionLabel, liked && { color: colors.danger }]}>Like</Text>
              </Pressable>
              <Pressable
                style={styles.actionBtn}
                onPress={() =>
                  navigation.navigate('ReviewModal', {
                    mediaType,
                    mediaId: id,
                    title: detail.title,
                    posterPath: detail.posterPath,
                    genreIds: detail.genreIds,
                  })
                }
              >
                <Ionicons name="create-outline" size={24} color={colors.text} />
                <Text style={styles.actionLabel}>Log/Review</Text>
              </Pressable>
              <Pressable
                style={styles.actionBtn}
                onPress={() =>
                  navigation.navigate('AddToList', {
                    mediaType,
                    mediaId: id,
                    title: detail.title,
                    posterPath: detail.posterPath,
                    genreIds: detail.genreIds,
                  })
                }
              >
                <Ionicons name="list-outline" size={24} color={colors.text} />
                <Text style={styles.actionLabel}>Add to List</Text>
              </Pressable>
            </View>
          </View>

          {trailer && (
            <Pressable
              style={styles.trailerBtn}
              onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${trailer.key}`)}
            >
              <Ionicons name="play-circle" size={20} color={colors.bg} />
              <Text style={styles.trailerText}>Watch Trailer</Text>
            </Pressable>
          )}

          <Text style={styles.sectionTitle}>Overview</Text>
          <Text style={styles.overview}>{detail.overview || 'No overview available.'}</Text>

          {director && (
            <Text style={styles.directorText}>
              <Text style={{ color: colors.textDim }}>{director.job}: </Text>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{director.name}</Text>
            </Text>
          )}
        </View>

        {(detail.cast.length > 0 || detail.crew.length > 0) && (
          <View style={styles.peopleSection}>
            <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.lg }]}>Cast & Crew</Text>
            {detail.cast.length > 0 && (
              <CastRow
                cast={detail.cast}
                onPress={(m) => navigation.navigate('Person', { personId: m.id, name: m.name })}
              />
            )}
            {detail.crew.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.crewRow}>
                {detail.crew.slice(0, 8).map((member) => (
                  <Pressable
                    key={`${member.id}-${member.job}`}
                    style={({ pressed }) => [styles.crewCard, pressed && styles.cardPressed]}
                    onPress={() => navigation.navigate('Person', { personId: member.id, name: member.name })}
                  >
                    {member.profile_path ? (
                      <Image source={{ uri: profileUrl(member.profile_path) ?? undefined }} style={styles.crewAvatar} contentFit="cover" />
                    ) : (
                      <View style={[styles.crewAvatar, styles.avatarFallback]}><Ionicons name="person" size={20} color={colors.textFaint} /></View>
                    )}
                    <View style={styles.crewInfo}>
                      <Text style={styles.crewName} numberOfLines={1}>{member.name}</Text>
                      <Text style={styles.crewJob} numberOfLines={1}>{member.job}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        <View style={styles.reviewsSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>TMDB Reviews</Text>
              <Text style={styles.sectionSubtitle}>What viewers are saying</Text>
            </View>
            {detail.reviews.length > 0 && <Text style={styles.reviewCount}>{detail.reviews.length} shown</Text>}
          </View>
          {detail.reviews.length === 0 ? (
            <EmptyState icon="chatbox-ellipses-outline" title="No TMDB reviews yet" message="Be the first to share your thoughts from the review action above." />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewsRow}>
              {detail.reviews.map((review) => (
                <Pressable
                  key={review.id}
                  style={({ pressed }) => [styles.reviewCard, pressed && styles.cardPressed]}
                  onPress={() => review.url && Linking.openURL(review.url)}
                  accessibilityRole="button"
                  accessibilityLabel={`Review by ${review.author}`}
                >
                  <View style={styles.reviewHeader}>
                    {review.authorAvatarPath ? (
                      <Image source={{ uri: profileUrl(review.authorAvatarPath) ?? undefined }} style={styles.reviewAvatar} contentFit="cover" />
                    ) : (
                      <View style={[styles.reviewAvatar, styles.avatarFallback]}><Ionicons name="person" size={18} color={colors.textFaint} /></View>
                    )}
                    <View style={styles.reviewAuthorBlock}>
                      <Text style={styles.reviewAuthor} numberOfLines={1}>{review.author}</Text>
                      {!!review.authorUsername && <Text style={styles.reviewUsername} numberOfLines={1}>@{review.authorUsername}</Text>}
                    </View>
                    {review.rating !== null && (
                      <View style={styles.reviewRating}><Ionicons name="star" size={13} color={colors.gold} /><Text style={styles.reviewRatingText}>{review.rating}/10</Text></View>
                    )}
                  </View>
                  <Text style={styles.reviewBody} numberOfLines={7}>{review.content.trim()}</Text>
                  <View style={styles.reviewFooter}>
                    <Text style={styles.reviewDate}>{formatReviewDate(review.createdAt)}</Text>
                    <Text style={styles.readReview}>Read full review</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        {mediaType === 'tv' && detail.seasons.length > 0 && (
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.lg }]}>Seasons</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              {detail.seasons
                .filter((s) => s.season_number > 0 || detail.seasons.length === 1)
                .map((s) => {
                  const sUri = posterUrl(s.poster_path, 'w200');
                  return (
                    <Pressable
                      key={s.id}
                      style={styles.seasonCard}
                      onPress={() => navigation.navigate('Season', { tvId: id, seasonNumber: s.season_number, tvName: detail.title })}
                    >
                      {sUri ? (
                        <Image source={{ uri: sUri }} style={styles.seasonPoster} contentFit="cover" />
                      ) : (
                        <View style={[styles.seasonPoster, styles.posterFallback]}>
                          <Ionicons name="tv-outline" size={24} color={colors.textFaint} />
                        </View>
                      )}
                      <Text numberOfLines={1} style={styles.seasonName}>{s.name}</Text>
                      <Text style={styles.seasonEpCount}>{s.episode_count} episodes</Text>
                    </Pressable>
                  );
                })}
            </ScrollView>
          </View>
        )}

        {diaryEntries.length > 0 && (
          <View style={{ marginBottom: spacing.lg, paddingHorizontal: spacing.lg }}>
            <Text style={styles.sectionTitle}>Your Logs</Text>
            {diaryEntries.map((entry) => (
              <Pressable
                key={entry.id}
                style={styles.logCard}
                onLongPress={() => handleDeleteEntry(entry.id)}
                onPress={() =>
                  navigation.navigate('ReviewModal', {
                    mediaType,
                    mediaId: id,
                    title: detail.title,
                    posterPath: detail.posterPath,
                    genreIds: detail.genreIds,
                    entryId: entry.id,
                  })
                }
              >
                <View style={styles.logHeader}>
                  <Text style={styles.logDate}>
                    {new Date(entry.watchedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  {entry.rewatch && <Text style={styles.rewatchTag}>Rewatch</Text>}
                </View>
                {!!entry.rating && <RatingStars rating={entry.rating} size={15} />}
                {!!entry.review && <Text style={styles.reviewText} numberOfLines={4}>{entry.review}</Text>}
              </Pressable>
            ))}
          </View>
        )}

        {detail.similar.length > 0 && (
          <SectionRow
            title={mediaType === 'movie' ? 'More Like This' : 'Similar Shows'}
            data={detail.similar}
            onItemPress={(item) => navigation.push('Detail', { mediaType: item.mediaType, id: item.id })}
          />
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  stateScreen: { flex: 1, backgroundColor: colors.bg },
  stateTopBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(10,13,18,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  animeTag: { backgroundColor: colors.accent3, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, justifyContent: 'center' },
  animeTagText: { color: '#04121B', fontSize: 10, fontWeight: '800' },
  headerRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginTop: -70, gap: spacing.md },
  posterWrap: { width: 108, height: 162, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.bg },
  poster: { width: '100%', height: '100%' },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1, justifyContent: 'flex-end', paddingBottom: spacing.xs },
  title: { color: colors.text, fontSize: fontSizes.xl, fontWeight: '800', lineHeight: 26 },
  metaLine: { color: colors.textDim, fontSize: fontSizes.sm, marginTop: 6, fontWeight: '600' },
  tmdbRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm },
  tmdbScore: { color: colors.text, fontWeight: '800', fontSize: fontSizes.md },
  tmdbLabel: { color: colors.textFaint, fontSize: fontSizes.xs },
  body: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  tagline: { color: colors.textDim, fontStyle: 'italic', fontSize: fontSizes.sm, marginTop: spacing.md },
  actionsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratingSection: { alignItems: 'center', marginBottom: spacing.md },
  ratingLabel: { color: colors.textDim, fontSize: fontSizes.xs, fontWeight: '700', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { alignItems: 'center', gap: 4, flex: 1 },
  actionLabel: { color: colors.textDim, fontSize: 10, fontWeight: '600' },
  trailerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  trailerText: { color: colors.bg, fontWeight: '800', fontSize: fontSizes.md },
  sectionTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '800', marginTop: spacing.xl, marginBottom: spacing.sm },
  overview: { color: colors.textDim, fontSize: fontSizes.md, lineHeight: 22 },
  directorText: { fontSize: fontSizes.sm, marginTop: spacing.md },
  peopleSection: { marginBottom: spacing.lg },
  crewRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.sm },
  crewCard: { width: 190, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  crewAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceHigh },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  crewInfo: { flex: 1 },
  crewName: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '700' },
  crewJob: { color: colors.textDim, fontSize: fontSizes.xs, marginTop: 2 },
  reviewsSection: { marginBottom: spacing.lg },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: spacing.lg },
  sectionSubtitle: { color: colors.textFaint, fontSize: fontSizes.xs, marginTop: -spacing.xs, marginBottom: spacing.sm },
  reviewCount: { color: colors.accent2, fontSize: fontSizes.xs, fontWeight: '700', marginBottom: spacing.sm },
  reviewsRow: { paddingHorizontal: spacing.lg, gap: spacing.md },
  reviewCard: { width: Math.min(width * 0.78, 330), backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceHigh },
  reviewAuthorBlock: { flex: 1 },
  reviewAuthor: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '800' },
  reviewUsername: { color: colors.textFaint, fontSize: 11, marginTop: 1 },
  reviewRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  reviewRatingText: { color: colors.gold, fontSize: fontSizes.xs, fontWeight: '800' },
  reviewBody: { color: colors.textDim, fontSize: fontSizes.sm, lineHeight: 20, marginTop: spacing.md },
  reviewFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  reviewDate: { color: colors.textFaint, fontSize: 11 },
  readReview: { color: colors.accent, fontSize: 11, fontWeight: '800' },
  cardPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  seasonCard: { width: 120 },
  seasonPoster: { width: 120, height: 170, borderRadius: radius.md, backgroundColor: colors.surface },
  seasonName: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '700', marginTop: spacing.xs },
  seasonEpCount: { color: colors.textFaint, fontSize: fontSizes.xs, marginTop: 1 },
  logCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  logDate: { color: colors.textDim, fontSize: fontSizes.xs, fontWeight: '700' },
  rewatchTag: { color: colors.accent2, fontSize: 10, fontWeight: '700' },
  reviewText: { color: colors.text, fontSize: fontSizes.sm, marginTop: spacing.xs, lineHeight: 20 },
});

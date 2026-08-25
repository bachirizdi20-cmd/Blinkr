import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRoute, RouteProp } from '@react-navigation/native';
import { ContentStackParamList } from '../navigation/types';
import { fetchSeasonDetail, backdropUrl } from '../lib/tmdb';
import { SeasonDetail } from '../types/tmdb';
import { useLibrary } from '../context/LibraryContext';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type RouteT = RouteProp<ContentStackParamList, 'Season'>;

export default function SeasonScreen() {
  const route = useRoute<RouteT>();
  const { tvId, seasonNumber, tvName } = route.params;
  const lib = useLibrary();

  const [season, setSeason] = useState<SeasonDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSeasonDetail(tvId, seasonNumber)
      .then(setSeason)
      .catch((e) => console.warn(e))
      .finally(() => setLoading(false));
  }, [tvId, seasonNumber]);

  const allWatched = season?.episodes.every((ep) => lib.isEpisodeWatched(tvId, seasonNumber, ep.episode_number)) ?? false;

  if (loading || !season) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.showName} numberOfLines={1}>{tvName}</Text>
        <Text style={styles.seasonTitle}>{season.name}</Text>
        {!!season.overview && <Text style={styles.overview} numberOfLines={4}>{season.overview}</Text>}
        <Pressable
          style={styles.bulkBtn}
          onPress={() =>
            lib.markSeasonWatched(
              tvId,
              seasonNumber,
              season.episodes.map((e) => e.episode_number),
              !allWatched
            )
          }
        >
          <Ionicons name={allWatched ? 'checkmark-circle' : 'checkmark-circle-outline'} size={18} color={allWatched ? colors.accent : colors.text} />
          <Text style={[styles.bulkBtnText, allWatched && { color: colors.accent }]}>
            {allWatched ? 'Season Watched' : 'Mark Season Watched'}
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={season.episodes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const watched = lib.isEpisodeWatched(tvId, seasonNumber, item.episode_number);
          const still = backdropUrl(item.still_path, 'w780');
          return (
            <Pressable
              style={styles.episodeCard}
              onPress={() => lib.toggleEpisodeWatched(tvId, seasonNumber, item.episode_number)}
            >
              <View style={styles.stillWrap}>
                {still ? (
                  <Image source={{ uri: still }} style={styles.still} contentFit="cover" />
                ) : (
                  <View style={[styles.still, styles.stillFallback]}>
                    <Ionicons name="tv-outline" size={20} color={colors.textFaint} />
                  </View>
                )}
              </View>
              <View style={styles.episodeInfo}>
                <Text style={styles.episodeNumber}>Episode {item.episode_number}</Text>
                <Text style={styles.episodeName} numberOfLines={2}>{item.name}</Text>
                {!!item.air_date && <Text style={styles.episodeAirDate}>{item.air_date}</Text>}
              </View>
              <Ionicons
                name={watched ? 'checkmark-circle' : 'ellipse-outline'}
                size={26}
                color={watched ? colors.accent : colors.textFaint}
              />
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  showName: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '600' },
  seasonTitle: { color: colors.text, fontSize: fontSizes.xl, fontWeight: '800', marginTop: 2 },
  overview: { color: colors.textDim, fontSize: fontSizes.sm, marginTop: spacing.sm, lineHeight: 19 },
  bulkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, alignSelf: 'flex-start' },
  bulkBtnText: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '700' },
  list: { padding: spacing.lg },
  episodeCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stillWrap: { width: 100, height: 62, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surfaceHigh },
  still: { width: '100%', height: '100%' },
  stillFallback: { alignItems: 'center', justifyContent: 'center' },
  episodeInfo: { flex: 1 },
  episodeNumber: { color: colors.textFaint, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  episodeName: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '700', marginTop: 2 },
  episodeAirDate: { color: colors.textFaint, fontSize: 10, marginTop: 2 },
});

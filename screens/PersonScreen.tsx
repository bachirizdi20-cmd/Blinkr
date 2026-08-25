import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PosterCard from '../components/PosterCard';
import EmptyState from '../components/EmptyState';
import { ContentStackParamList } from '../navigation/types';
import { fetchPersonCredits, fetchPersonDetail, profileUrl } from '../lib/tmdb';
import { NormalizedItem } from '../types/tmdb';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type RouteT = RouteProp<ContentStackParamList, 'Person'>;

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GUTTER = spacing.md;
const CARD_WIDTH = (width - spacing.lg * 2 - GUTTER * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export default function PersonScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { personId, name } = route.params;

  const [credits, setCredits] = useState<NormalizedItem[]>([]);
  const [bio, setBio] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchPersonCredits(personId), fetchPersonDetail(personId)])
      .then(([creditsData, personData]) => {
        const sorted = creditsData.sort((a, b) => (b.voteAverage * b.voteCount) - (a.voteAverage * a.voteCount));
        setCredits(sorted);
        setBio(personData.biography ?? '');
        setPhoto(personData.profile_path ? profileUrl(personData.profile_path) : null);
      })
      .catch((e) => console.warn(e))
      .finally(() => setLoading(false));
  }, [personId]);

  if (loading) {
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
      <FlatList
        data={credits}
        keyExtractor={(item) => `${item.mediaType}-${item.id}`}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={{ gap: GUTTER }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.avatarWrap}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={40} color={colors.textFaint} />
                </View>
              )}
            </View>
            <Text style={styles.name}>{name}</Text>
            {!!bio && <Text style={styles.bio} numberOfLines={6}>{bio}</Text>}
            <Text style={styles.sectionTitle}>Known For</Text>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="film-outline" title="No filmography" />}
        renderItem={({ item }) => (
          <PosterCard
            item={item}
            width={CARD_WIDTH}
            onPress={() => navigation.push('Detail', { mediaType: item.mediaType, id: item.id })}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { padding: spacing.lg },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  avatarWrap: { width: 120, height: 120, borderRadius: 60, overflow: 'hidden', backgroundColor: colors.surface, marginBottom: spacing.md },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: fontSizes.xl, fontWeight: '800', textAlign: 'center' },
  bio: { color: colors.textDim, fontSize: fontSizes.sm, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20, paddingHorizontal: spacing.md },
  sectionTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '800', alignSelf: 'flex-start', marginTop: spacing.xl },
});

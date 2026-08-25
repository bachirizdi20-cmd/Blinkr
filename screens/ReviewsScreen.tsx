import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import RatingStars from '../components/RatingStars';
import EmptyState from '../components/EmptyState';
import { ContentStackParamList } from '../navigation/types';
import { useLibrary, DiaryEntry } from '../context/LibraryContext';
import { posterUrl } from '../lib/tmdb';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;

export default function ReviewsScreen() {
  const navigation = useNavigation<Nav>();
  const lib = useLibrary();
  const entries = lib.diary.filter((e) => !!e.review).sort((a, b) => b.createdAt - a.createdAt);

  const renderItem = ({ item }: { item: DiaryEntry }) => (
    <Pressable
      style={styles.card}
      onPress={() => navigation.navigate('Detail', { mediaType: item.mediaType, id: item.mediaId })}
    >
      <View style={styles.cardHeader}>
        <Image source={{ uri: posterUrl(item.posterPath, 'w200') ?? undefined }} style={styles.poster} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.date}>{item.watchedDate}</Text>
          {!!item.rating && <RatingStars rating={item.rating} size={14} />}
        </View>
      </View>
      <Text style={styles.review}>{item.review}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Text style={styles.header}>Reviews</Text>
      {entries.length === 0 ? (
        <EmptyState icon="chatbox-ellipses-outline" title="No reviews yet" message="Write a review when logging a title." />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { color: colors.text, fontSize: fontSizes.xxl, fontWeight: '800', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  poster: { width: 46, height: 66, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh },
  title: { color: colors.text, fontSize: fontSizes.md, fontWeight: '700' },
  date: { color: colors.textFaint, fontSize: 11, marginTop: 2, marginBottom: 4 },
  review: { color: colors.textDim, fontSize: fontSizes.sm, lineHeight: 20 },
});

import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import RatingStars from '../components/RatingStars';
import EmptyState from '../components/EmptyState';
import { ContentStackParamList } from '../navigation/types';
import { useLibrary, DiaryEntry } from '../context/LibraryContext';
import { posterUrl } from '../lib/tmdb';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;

export default function DiaryScreen() {
  const navigation = useNavigation<Nav>();
  const lib = useLibrary();
  const entries = [...lib.diary].sort((a, b) => b.createdAt - a.createdAt);

  const renderItem = ({ item }: { item: DiaryEntry }) => (
    <Pressable
      style={styles.row}
      onPress={() =>
        navigation.navigate('ReviewModal', {
          mediaType: item.mediaType,
          mediaId: item.mediaId,
          title: item.title,
          posterPath: item.posterPath,
          genreIds: item.genreIds,
          entryId: item.id,
        })
      }
    >
      <Image source={{ uri: posterUrl(item.posterPath, 'w200') ?? undefined }} style={styles.poster} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.date}>{item.watchedDate}{item.rewatch ? '  •  Rewatch' : ''}</Text>
        {!!item.rating && <RatingStars rating={item.rating} size={14} />}
        {!!item.review && <Text numberOfLines={2} style={styles.review}>{item.review}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Text style={styles.header}>Diary</Text>
      {entries.length === 0 ? (
        <EmptyState icon="book-outline" title="No diary entries" message="Log titles from their detail page to start your diary." />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { color: colors.text, fontSize: fontSizes.xxl, fontWeight: '800', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  poster: { width: 50, height: 72, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh },
  title: { color: colors.text, fontSize: fontSizes.md, fontWeight: '700' },
  date: { color: colors.textFaint, fontSize: 11, marginTop: 2, marginBottom: 4 },
  review: { color: colors.textDim, fontSize: fontSizes.xs, marginTop: 4, lineHeight: 16 },
});

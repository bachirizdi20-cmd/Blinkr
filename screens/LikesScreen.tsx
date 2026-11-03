import React from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PosterCard from '../components/PosterCard';
import EmptyState from '../components/EmptyState';
import { ContentStackParamList } from '../navigation/types';
import { useLibrary } from '../context/LibraryContext';
import { openCatalogItem } from '../lib/catalog-navigation';
import { colors, fontSizes, spacing } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GUTTER = spacing.md;
const CARD_WIDTH = (width - spacing.lg * 2 - GUTTER * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export default function LikesScreen() {
  const navigation = useNavigation<Nav>();
  const lib = useLibrary();
  const items = Object.values(lib.likes).sort((a, b) => b.likedAt - a.likedAt);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Text style={styles.header}>المفضلة</Text>
      {items.length === 0 ? (
        <EmptyState icon="heart-outline" title="لا توجد عناصر مفضلة بعد" message="اضغط على رمز القلب في أي عنوان لإضافته إلى المفضلة." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.mediaType}-${item.mediaId}`}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: GUTTER }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
          renderItem={({ item }) => (
            <PosterCard
              item={{ id: item.mediaId, mediaType: item.mediaType, title: item.title, posterPath: item.posterPath, date: item.date, voteAverage: item.voteAverage }}
              width={CARD_WIDTH}
              onPress={() => openCatalogItem(navigation, item)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { color: colors.text, fontSize: fontSizes.xxl, fontWeight: '800', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  grid: { padding: spacing.lg },
});

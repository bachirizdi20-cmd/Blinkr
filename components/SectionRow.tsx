import React from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import SectionHeader from './SectionHeader';
import PosterCard from './PosterCard';
import { NormalizedItem } from '../types/tmdb';
import { colors, spacing } from '../lib/theme';

interface Props {
  title: string;
  subtitle?: string;
  data: NormalizedItem[];
  loading?: boolean;
  onSeeAll?: () => void;
  onItemPress: (item: NormalizedItem) => void;
}

export default function SectionRow({ title, subtitle, data, loading, onSeeAll, onItemPress }: Props) {
  return (
    <View style={styles.container}>
      <SectionHeader title={title} subtitle={subtitle} onSeeAll={onSeeAll} />
      {loading && data.length === 0 ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={data}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => `${item.mediaType}-${item.id}`}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <PosterCard item={item} onPress={() => onItemPress(item)} width={112} />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  listContent: { paddingHorizontal: spacing.lg, gap: spacing.md },
  cardWrap: { marginRight: spacing.sm },
  loadingRow: { height: 168, alignItems: 'center', justifyContent: 'center' },
});

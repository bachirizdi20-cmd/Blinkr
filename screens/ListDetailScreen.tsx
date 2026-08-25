import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PosterCard from '../components/PosterCard';
import EmptyState from '../components/EmptyState';
import { ContentStackParamList } from '../navigation/types';
import { useLibrary } from '../context/LibraryContext';
import { searchMulti } from '../lib/tmdb';
import { NormalizedItem } from '../types/tmdb';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type RouteT = RouteProp<ContentStackParamList, 'ListDetail'>;

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GUTTER = spacing.md;
const CARD_WIDTH = (width - spacing.lg * 2 - GUTTER * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export default function ListDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const lib = useLibrary();
  const list = lib.lists.find((l) => l.id === route.params.listId);

  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NormalizedItem[]>([]);
  const [searching, setSearching] = useState(false);

  if (!list) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState icon="alert-circle-outline" title="List not found" />
      </SafeAreaView>
    );
  }

  const runSearch = async (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const data = await searchMulti(q, 1);
      setResults(data.results);
    } finally {
      setSearching(false);
    }
  };

  const handleDeleteList = () => {
    Alert.alert('Delete list', `Delete "${list.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { lib.deleteList(list.id); navigation.goBack(); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.header} numberOfLines={1}>{list.name}</Text>
          {!!list.description && <Text style={styles.desc} numberOfLines={2}>{list.description}</Text>}
          <Text style={styles.count}>{list.items.length} titles</Text>
        </View>
        <Pressable style={styles.iconBtn} onPress={() => setAdding((v) => !v)}>
          <Ionicons name={adding ? 'close' : 'add'} size={20} color={colors.text} />
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={handleDeleteList}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
      </View>

      {adding && (
        <View style={styles.searchBox}>
          <TextInput
            style={styles.input}
            placeholder="Search to add titles..."
            placeholderTextColor={colors.textFaint}
            value={query}
            onChangeText={runSearch}
            autoFocus
          />
          {results.length > 0 && (
            <View style={styles.resultsBox}>
              {results.slice(0, 6).map((item) => {
                const included = lib.isItemInList(list.id, item.mediaType, item.id);
                return (
                  <Pressable
                    key={`${item.mediaType}-${item.id}`}
                    style={styles.resultRow}
                    onPress={() =>
                      lib.toggleItemInList(list.id, {
                        mediaType: item.mediaType,
                        mediaId: item.id,
                        title: item.title,
                        posterPath: item.posterPath,
                        genreIds: item.genreIds,
                        voteAverage: item.voteAverage,
                        date: item.date,
                      })
                    }
                  >
                    <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                    <Ionicons name={included ? 'checkmark-circle' : 'add-circle-outline'} size={20} color={included ? colors.accent : colors.textFaint} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}

      {list.items.length === 0 ? (
        <EmptyState icon="film-outline" title="List is empty" message="Tap + to search and add titles." />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(item) => `${item.mediaType}-${item.mediaId}`}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: GUTTER }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
          renderItem={({ item }) => (
            <PosterCard
              item={{ id: item.mediaId, mediaType: item.mediaType, title: item.title, posterPath: item.posterPath, date: item.date, voteAverage: item.voteAverage }}
              width={CARD_WIDTH}
              onPress={() => navigation.navigate('Detail', { mediaType: item.mediaType, id: item.mediaId })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  header: { color: colors.text, fontSize: fontSizes.xl, fontWeight: '800' },
  desc: { color: colors.textDim, fontSize: fontSizes.sm, marginTop: 2 },
  count: { color: colors.textFaint, fontSize: fontSizes.xs, marginTop: 4, fontWeight: '700' },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  searchBox: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, color: colors.text, borderWidth: 1, borderColor: colors.border },
  resultsBox: { backgroundColor: colors.surface, borderRadius: radius.md, marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultTitle: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '600', flex: 1, marginRight: spacing.sm },
  grid: { padding: spacing.lg },
});

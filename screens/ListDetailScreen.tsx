import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, FlatList, Pressable, TextInput, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PosterCard from '../components/PosterCard';
import EmptyState from '../components/EmptyState';
import { ContentStackParamList } from '../navigation/types';
import { useLibrary } from '../context/LibraryContext';
import { openCatalogItem } from '../lib/catalog-navigation';
import { searchMulti } from '../lib/tmdb';
import { NormalizedItem } from '../types/tmdb';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import { PlatformAlert as Alert } from '../lib/platform-alert';

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
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<NormalizedItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [retryNumber, setRetryNumber] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    if (debouncedQuery.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError(false);
      return () => { active = false; };
    }
    setSearching(true);
    setSearchError(false);
    void searchMulti(debouncedQuery, 1)
      .then((data) => { if (active) setResults(data.results); })
      .catch(() => { if (active) { setResults([]); setSearchError(true); } })
      .finally(() => { if (active) setSearching(false); });
    return () => { active = false; };
  }, [debouncedQuery, retryNumber]);

  if (!list) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState icon="alert-circle-outline" title="القائمة غير موجودة" />
      </SafeAreaView>
    );
  }

  const handleDeleteList = () => {
    Alert.alert('حذف القائمة', `هل تريد حذف «${list.name}»؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: () => { lib.deleteList(list.id); navigation.goBack(); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.header} numberOfLines={1}>{list.name}</Text>
          {!!list.description && <Text style={styles.desc} numberOfLines={2}>{list.description}</Text>}
          <Text style={styles.count}>{list.items.length.toLocaleString('ar')} عنصر</Text>
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
            placeholder="ابحث لإضافة عناصر…"
            placeholderTextColor={colors.textFaint}
            value={query}
            onChangeText={(value) => { setQuery(value); setResults([]); setSearchError(false); }}
            autoFocus
          />
          {query.trim().length > 0 && (
            <View style={styles.resultsBox}>
              {query.trim().length < 2 ? <Text style={styles.searchMessage}>اكتب حرفين على الأقل لبدء البحث.</Text> : searchError ? <View style={styles.searchMessageRow}><Text style={styles.searchError}>تعذر البحث الآن. تحقق من الاتصال وحاول مجددًا.</Text><Pressable onPress={() => setRetryNumber((value) => value + 1)}><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable></View> : searching || query.trim() !== debouncedQuery ? <View style={styles.searchMessageRow}><ActivityIndicator size="small" color={colors.accent} /><Text style={styles.searchMessage}>جارٍ البحث…</Text></View> : results.length === 0 ? <Text style={styles.searchMessage}>لا توجد نتائج. جرّب كلمات أخرى.</Text> : results.slice(0, 6).map((item) => {
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
        <EmptyState icon="film-outline" title="القائمة فارغة" message="اضغط على + للبحث عن عناصر وإضافتها." />
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
  searchMessageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  searchMessage: { color: colors.textDim, fontSize: fontSizes.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  searchError: { color: colors.danger, fontSize: fontSizes.sm, flex: 1 },
  retryText: { color: colors.accent, fontSize: fontSizes.sm, fontWeight: '800', padding: spacing.sm },
  grid: { padding: spacing.lg },
});

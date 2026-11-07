import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import BookCard from '../components/BookCard';
import ApiErrorState from '../components/ApiErrorState';
import { ContentStackParamList } from '../navigation/types';
import { trpc } from '../lib/trpc';
import { BookSummary } from '../types/books';
import { colors, fontSizes, spacing } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type RouteT = RouteProp<ContentStackParamList, 'AuthorBooks'>;

export default function AuthorBooksScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { authorName, excludeWorkId } = route.params;
  const query = trpc.books.author.useQuery({ author: authorName, excludeWorkId, limit: 50 }, { retry: 1 });
  const books = ((query.data ?? []) as BookSummary[]).filter((book) => Boolean(book.coverUrl));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="رجوع"><Ionicons name="chevron-back" size={22} color={colors.text} /></Pressable>
        <View style={styles.heading}><Text style={styles.title}>كتب المؤلف</Text><Text style={styles.author} numberOfLines={1}>{authorName}</Text></View>
        <View style={styles.back} />
      </View>
      {query.isLoading ? <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /><Text style={styles.muted}>جارٍ تحميل كتب المؤلف…</Text></View> : query.isError ? <ApiErrorState message="تعذر تحميل كتب المؤلف من Hardcover." onRetry={() => void query.refetch()} /> : books.length === 0 ? <View style={styles.center}><Ionicons name="book-outline" size={34} color={colors.textFaint} /><Text style={styles.muted}>لا توجد كتب بأغلفة متاحة لهذا المؤلف.</Text></View> : <FlatList
        data={books}
        numColumns={3}
        keyExtractor={(book) => String(book.workId)}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => <BookCard book={item} width={106} onPress={() => navigation.push('BookDetail', { workId: item.workId, book: item })} />}
        showsVerticalScrollIndicator={false}
      />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, alignItems: 'center' },
  title: { color: colors.text, fontSize: fontSizes.md, fontWeight: '900' },
  author: { color: colors.accent, fontSize: fontSizes.xs, fontWeight: '700', marginTop: 2 },
  grid: { padding: spacing.lg, paddingBottom: spacing.xxl },
  row: { justifyContent: 'space-between', marginBottom: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  muted: { color: colors.textDim, fontSize: fontSizes.sm, textAlign: 'center' },
});

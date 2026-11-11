import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ComicCard from '../components/ComicCard';
import ApiErrorState from '../components/ApiErrorState';
import { ContentStackParamList } from '../navigation/types';
import { trpc } from '../lib/trpc';
import { ComicSummary } from '../types/comics';
import { colors, fontSizes, spacing } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type RouteT = RouteProp<ContentStackParamList, 'ComicCreator'>;

export default function ComicCreatorScreen() {
  const navigation = useNavigation<Nav>();
  const { creatorName, excludeId } = useRoute<RouteT>().params;
  const query = trpc.comics.search.useQuery({ query: creatorName, page: 1, limit: 20 }, { retry: 1 });
  const comics = (query.data?.results ?? []).filter((item: ComicSummary) => item.id !== excludeId && Boolean(item.coverUrl));
  return <SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.topBar}><Pressable onPress={() => navigation.goBack()} style={styles.back}><Ionicons name="chevron-back" size={22} color={colors.text} /></Pressable><View style={styles.heading}><Text style={styles.title}>أعمال المؤلف</Text><Text style={styles.author} numberOfLines={1}>{creatorName}</Text></View><View style={styles.back} /></View>
    {query.isLoading ? <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /><Text style={styles.muted}>جارٍ تحميل الأعمال…</Text></View> : query.isError ? <ApiErrorState message="تعذر تحميل أعمال مؤلف الكوميك." onRetry={() => void query.refetch()} /> : comics.length === 0 ? <View style={styles.center}><Ionicons name="color-wand-outline" size={34} color={colors.textFaint} /><Text style={styles.muted}>لا توجد أعمال بأغلفة متاحة لهذا المؤلف.</Text></View> : <FlatList data={comics} numColumns={3} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.grid} columnWrapperStyle={styles.row} renderItem={({ item }) => <ComicCard comic={item} width={106} onPress={() => navigation.push('ComicDetail', { id: item.id, comic: item })} />} showsVerticalScrollIndicator={false} />}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg }, topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }, back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, heading: { flex: 1, alignItems: 'center' }, title: { color: colors.text, fontSize: fontSizes.md, fontWeight: '900' }, author: { color: colors.accent, fontSize: fontSizes.xs, fontWeight: '700', marginTop: 2 }, grid: { padding: spacing.lg, paddingBottom: spacing.xxl }, row: { justifyContent: 'space-between', marginBottom: spacing.lg }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg }, muted: { color: colors.textDim, fontSize: fontSizes.sm, textAlign: 'center' } });

import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ContentStackParamList } from '../navigation/types';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type RouteT = RouteProp<ContentStackParamList, 'BookDetail'>;

export default function BookDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteT>();
  const { book } = route.params;
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}><Pressable onPress={() => navigation.goBack()} hitSlop={8}><Ionicons name="chevron-back" size={25} color={colors.text} /></Pressable><Text style={styles.headerTitle}>Book details</Text><View style={{ width: 25 }} /></View>
      <ScrollView contentContainerStyle={styles.content}>
        <Image source={{ uri: book.coverUrl ?? undefined }} style={styles.cover} />
        <Text style={styles.title}>{book.title}</Text>
        <Text style={styles.authors}>{book.authors?.join(', ') || 'Unknown author'}</Text>
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}><Text style={styles.metaLabel}>Published</Text><Text style={styles.metaValue}>{book.publishedYear ?? '—'}</Text></View>
          <View style={styles.metaItem}><Text style={styles.metaLabel}>Pages</Text><Text style={styles.metaValue}>{book.pageCount ?? '—'}</Text></View>
          <View style={styles.metaItem}><Text style={styles.metaLabel}>Language</Text><Text style={styles.metaValue}>{book.language ?? '—'}</Text></View>
        </View>
        {book.publisher ? <Text style={styles.publisher}>Published by {book.publisher}</Text> : null}
        {book.isbn13 || book.isbn10 ? <Text style={styles.isbn}>ISBN: {book.isbn13 ?? book.isbn10}</Text> : null}
        {book.subjects?.length ? <View style={styles.section}><Text style={styles.sectionTitle}>Subjects</Text><View style={styles.subjects}>{book.subjects.slice(0, 8).map((subject: string) => <View key={subject} style={styles.subject}><Text style={styles.subjectText}>{subject}</Text></View>)}</View></View> : null}
        <Pressable style={({ pressed }) => [styles.reviewButton, pressed && styles.pressed]} onPress={() => navigation.navigate('ReviewModal', { mediaType: 'book', mediaId: book.id, title: book.title, posterPath: book.coverUrl, genreIds: [] })}><Ionicons name="create-outline" size={19} color={colors.bg} /><Text style={styles.reviewButtonText}>Write a review</Text></Pressable>
        <Text style={styles.source}>Book data and cover from Open Library</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '800' },
  content: { alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  cover: { width: 190, height: 280, borderRadius: radius.md, backgroundColor: colors.surfaceHigh, marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: 26, lineHeight: 31, textAlign: 'center', fontWeight: '900' },
  authors: { color: colors.accent, fontSize: fontSizes.md, fontWeight: '700', textAlign: 'center', marginTop: spacing.sm },
  metaGrid: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginTop: spacing.xl, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md },
  metaItem: { alignItems: 'center', flex: 1 },
  metaLabel: { color: colors.textFaint, fontSize: 10, textTransform: 'uppercase', fontWeight: '800' },
  metaValue: { color: colors.text, fontSize: fontSizes.md, fontWeight: '800', marginTop: 4 },
  publisher: { color: colors.textDim, fontSize: fontSizes.sm, marginTop: spacing.md, textAlign: 'center' },
  isbn: { color: colors.textFaint, fontSize: 11, marginTop: spacing.xs },
  section: { width: '100%', marginTop: spacing.xl },
  sectionTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '900', marginBottom: spacing.sm },
  subjects: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  subject: { backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: spacing.sm, paddingVertical: 6, borderWidth: 1, borderColor: colors.border },
  subjectText: { color: colors.textDim, fontSize: 11 },
  reviewButton: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14, marginTop: spacing.xl },
  reviewButtonText: { color: colors.bg, fontWeight: '900', fontSize: fontSizes.md },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  source: { color: colors.textFaint, fontSize: 10, marginTop: spacing.md },
});

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ContentStackParamList } from '../navigation/types';
import { useLibrary } from '../context/LibraryContext';
import { useAuth } from '../hooks/use-auth';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import { trpc } from '../lib/trpc';
import { ReviewMediaType } from '../types/tmdb';
import { PlatformAlert as Alert } from '../lib/platform-alert';

type RouteT = RouteProp<ContentStackParamList, 'ReviewModal'>;

export default function ReviewModalScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteT>();
  const { mediaType, mediaId, title, posterPath, genreIds, entryId } = route.params;
  const { user } = useAuth();
  const lib = useLibrary();
  const existing = entryId
    ? lib.diary.find((entry) => entry.id === entryId)
    : lib.getDiaryForMedia(mediaType, mediaId).sort((a, b) => b.createdAt - a.createdAt)[0];
  const savedReviewQuery = trpc.reviews.getMine.useQuery(
    { mediaType, mediaId },
    { enabled: Boolean(user), retry: false },
  );
  const saveReviewMutation = trpc.reviews.save.useMutation();
  const deleteReviewMutation = trpc.reviews.delete.useMutation();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [review, setReview] = useState(existing?.review ?? '');
  const [date, setDate] = useState(existing?.watchedDate ?? new Date().toISOString().slice(0, 10));
  const [spoiler, setSpoiler] = useState(existing?.spoiler ?? false);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState(false);
  const listCount = lib.lists.filter((list) => lib.isItemInList(list.id, mediaType, mediaId)).length;
  const mediaLabel = mediaType === 'book' ? 'كتاب' : mediaType === 'tv' ? 'مسلسل' : 'فيلم';
  const imageUri = posterPath ? (posterPath.startsWith('http') ? posterPath : `https://image.tmdb.org/t/p/w342${posterPath}`) : undefined;
  const isEditing = Boolean(existing || savedReviewQuery.data);

  useEffect(() => {
    const saved = savedReviewQuery.data;
    if (!saved || existing || edited) return;
    setRating(Number(saved.rating) || 0);
    setReview(saved.review ?? '');
    setSpoiler(Boolean(saved.spoiler));
    if (saved.watchedDate) setDate(new Date(saved.watchedDate).toISOString().slice(0, 10));
  }, [savedReviewQuery.data, existing, edited]);

  const handleSave = async () => {
    const trimmedReview = review.trim();
    if (rating === 0 && !trimmedReview) {
      Alert.alert('أضف تقييمًا أو مراجعة', 'اختر تقييمًا أو اكتب رأيك قبل الحفظ.');
      return;
    }
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const watchedDate = date.trim() ? new Date(`${date.trim()}T00:00:00.000Z`) : null;
    if (watchedDate && (!datePattern.test(date.trim()) || Number.isNaN(watchedDate.getTime()) || watchedDate.toISOString().slice(0, 10) !== date.trim())) {
      Alert.alert('التاريخ غير صالح', 'اكتب التاريخ بصيغة سنة-شهر-يوم، مثل 2026-11-03.');
      return;
    }
    setSaving(true);
    try {
      await saveReviewMutation.mutateAsync({
        mediaType,
        mediaId,
        title,
        posterPath: posterPath ?? null,
        rating,
        review: trimmedReview,
        spoiler,
        watchedDate: watchedDate?.toISOString() ?? null,
      });
      const payload = {
        mediaType,
        mediaId,
        title,
        posterPath,
        genreIds,
        watchedDate: date.trim() || new Date().toISOString().slice(0, 10),
        rating: rating > 0 ? rating : undefined,
        review: trimmedReview || undefined,
        rewatch: existing?.rewatch ?? false,
        spoiler,
      };
      if (existing) lib.updateDiaryEntry(existing.id, payload);
      else lib.addDiaryEntry(payload);
      navigation.goBack();
    } catch (error) {
      Alert.alert('تعذر حفظ المراجعة', error instanceof Error ? error.message : 'تحقق من الاتصال ثم حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('حذف المراجعة؟', 'سيتم حذف المراجعة نهائيًا.', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReviewMutation.mutateAsync({ mediaType, mediaId });
            if (existing) lib.deleteDiaryEntry(existing.id);
            navigation.goBack();
          } catch (error) {
            Alert.alert('تعذر حذف المراجعة', error instanceof Error ? error.message : 'حاول مرة أخرى.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.topBar}>
            <Pressable onPress={() => navigation.goBack()} style={styles.closeButton} hitSlop={8} accessibilityLabel="إغلاق">
              <Ionicons name="close" size={28} color={colors.text} />
            </Pressable>
            <Text style={styles.topTitle}>مراجعة جديدة</Text>
            <View style={styles.typeBadge}><Ionicons name={mediaType === 'book' ? 'book-outline' : 'film-outline'} size={14} color={colors.accent} /><Text style={styles.typeText}>{mediaLabel}</Text></View>
          </View>

          <Text style={styles.heading}>{isEditing ? 'عدّل رأيك' : 'شارك رأيك'}</Text>
          <Text style={styles.subtitle}>مراجعتك ستكون ظاهرة للجميع في Blinkr.</Text>

          <View style={styles.mediaCard}>
            {imageUri ? <Image source={{ uri: imageUri }} style={styles.mediaCover} contentFit="cover" /> : <View style={[styles.mediaCover, styles.coverFallback]}><Ionicons name={mediaType === 'book' ? 'book-outline' : 'film-outline'} size={30} color={colors.textFaint} /></View>}
            <View style={styles.mediaCopy}>
              <Text style={styles.mediaTitle} numberOfLines={3}>{title}</Text>
              <Text style={styles.mediaMeta}>{mediaLabel}</Text>
              <View style={styles.mediaRating}><Ionicons name="star" size={17} color={colors.gold} /><Text style={styles.mediaRatingText}>{rating > 0 ? `${rating}/10` : 'لم تقيّمه بعد'}</Text></View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>تقييمك من 10</Text>
            <View style={styles.ratingRow}>
              {Array.from({ length: 10 }, (_, index) => {
                const value = index + 1;
                return <Pressable key={value} onPress={() => { setRating(value); setEdited(true); }} hitSlop={4} accessibilityLabel={`تقييم ${value} من 10`}><Ionicons name={value <= rating ? 'star' : 'star-outline'} size={27} color={value <= rating ? colors.gold : colors.textFaint} /></Pressable>;
              })}
            </View>
            {rating > 0 ? <Pressable onPress={() => { setRating(0); setEdited(true); }} style={styles.clearRating}><Text style={styles.clearRatingText}>إزالة التقييم</Text></Pressable> : null}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>مراجعتك</Text><Text style={styles.counter}>{review.length}/1000</Text></View>
            <TextInput style={styles.reviewInput} value={review} onChangeText={(value) => { setReview(value.slice(0, 1000)); setEdited(true); }} placeholder="ما رأيك في هذا العنوان؟" placeholderTextColor={colors.textFaint} multiline textAlignVertical="top" />
            <View style={styles.spoilerRow}><View style={styles.spoilerCopy}><Ionicons name="warning-outline" size={18} color={spoiler ? colors.accent2 : colors.textFaint} /><View><Text style={styles.spoilerTitle}>تحتوي على حرق للأحداث</Text><Text style={styles.spoilerHint}>سنخفي نص المراجعة حتى يختار القارئ إظهارها.</Text></View></View><Switch value={spoiler} onValueChange={(value) => { setSpoiler(value); setEdited(true); }} trackColor={{ false: colors.surfaceHigh, true: colors.accent }} thumbColor={colors.text} /></View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{mediaType === 'book' ? 'تاريخ القراءة' : 'تاريخ المشاهدة'}</Text>
            <TextInput style={styles.dateInput} value={date} onChangeText={(value) => { setDate(value); setEdited(true); }} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textFaint} keyboardType="numbers-and-punctuation" returnKeyType="done" />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>القوائم</Text><Text style={styles.counter}>{listCount} قائمة</Text></View>
            <Pressable style={styles.listRow} onPress={() => navigation.navigate('AddToList', { mediaType, mediaId, title, posterPath: posterPath ?? null, genreIds })}>
              <View style={styles.listActionCopy}><Ionicons name="list-outline" size={20} color={colors.accent} /><Text style={styles.listText}>{listCount ? 'إدارة القوائم التي أضفت هذا العنوان إليها' : 'إضافة العنوان إلى قائمة'}</Text></View>
              <Ionicons name="chevron-forward" size={19} color={colors.textDim} />
            </Pressable>
          </View>

          <View style={styles.publicNote}><Ionicons name="globe-outline" size={19} color={colors.accent} /><Text style={styles.publicText}>النشر عام دائمًا؛ يمكن للجميع اكتشاف هذه المراجعة وعرضها.</Text></View>

          <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => [styles.postButton, pressed && styles.postPressed, saving && styles.disabled]}>
            {saving ? <ActivityIndicator color={colors.bg} /> : <Ionicons name="send" size={18} color={colors.bg} />}
            <Text style={styles.postText}>{saving ? 'جارٍ الحفظ…' : isEditing ? 'حفظ التغييرات' : 'نشر المراجعة'}</Text>
          </Pressable>
          {isEditing ? <Pressable onPress={handleDelete} style={styles.deleteButton}><Ionicons name="trash-outline" size={17} color={colors.danger} /><Text style={styles.deleteText}>حذف المراجعة</Text></Pressable> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xl * 2 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeButton: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  topTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '800' },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 62, justifyContent: 'flex-end' },
  typeText: { color: colors.accent, fontSize: fontSizes.xs, fontWeight: '800' },
  heading: { color: colors.text, fontSize: 30, lineHeight: 38, fontWeight: '900', marginTop: spacing.lg, paddingHorizontal: spacing.lg, textAlign: 'right' },
  subtitle: { color: colors.textDim, fontSize: fontSizes.sm, lineHeight: 21, marginTop: 3, paddingHorizontal: spacing.lg, textAlign: 'right' },
  mediaCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  mediaCover: { width: 80, height: 116, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  mediaCopy: { flex: 1, gap: 6 },
  mediaTitle: { color: colors.text, fontSize: fontSizes.lg, lineHeight: 24, fontWeight: '900', textAlign: 'right' },
  mediaMeta: { color: colors.textDim, fontSize: fontSizes.sm, textAlign: 'right' },
  mediaRating: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  mediaRatingText: { color: colors.gold, fontSize: fontSizes.sm, fontWeight: '800' },
  section: { marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '900', textAlign: 'right' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 1, marginTop: spacing.md },
  clearRating: { alignSelf: 'flex-start', marginTop: spacing.xs, paddingVertical: 4 },
  clearRatingText: { color: colors.textFaint, fontSize: fontSizes.xs },
  counter: { color: colors.textDim, fontSize: fontSizes.xs },
  reviewInput: { minHeight: 130, marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: fontSizes.md, lineHeight: 23, textAlign: 'right' },
  spoilerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  spoilerCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  spoilerTitle: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '800', textAlign: 'right' },
  spoilerHint: { color: colors.textFaint, fontSize: fontSizes.xs, marginTop: 3, textAlign: 'right' },
  dateInput: { minHeight: 46, marginTop: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: fontSizes.md, textAlign: 'right' },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 54, marginTop: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  listActionCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  listText: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '700', textAlign: 'right' },
  publicNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, backgroundColor: 'rgba(31, 215, 171, 0.08)', borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(31, 215, 171, 0.2)' },
  publicText: { flex: 1, color: colors.textDim, fontSize: fontSizes.xs, lineHeight: 18, textAlign: 'right' },
  postButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.xl, paddingHorizontal: spacing.md, backgroundColor: colors.accent, borderRadius: radius.md },
  postPressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.6 },
  postText: { color: colors.bg, fontSize: fontSizes.md, fontWeight: '900' },
  deleteButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.sm },
  deleteText: { color: colors.danger, fontSize: fontSizes.sm, fontWeight: '800' },
});

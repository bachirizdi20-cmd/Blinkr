import React, { useState } from 'react';
import {
  Alert,
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
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import { trpc } from '../lib/trpc';

type RouteT = RouteProp<ContentStackParamList, 'ReviewModal'>;
type MediaTab = 'movie' | 'tv' | 'book';

const tabs: { key: MediaTab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'movie', label: 'Movie', icon: 'film' },
  { key: 'tv', label: 'TV Show', icon: 'tv-outline' },
  { key: 'book', label: 'Book', icon: 'book-outline' },
];

export default function ReviewModalScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteT>();
  const { mediaType, mediaId, title, posterPath, genreIds, entryId } = route.params;
  const lib = useLibrary();
  const existing = entryId ? lib.diary.find((entry) => entry.id === entryId) : undefined;
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [review, setReview] = useState(existing?.review ?? '');
  const [date, setDate] = useState(existing?.watchedDate ?? new Date().toISOString().slice(0, 10));
  const [rewatch, setRewatch] = useState(existing?.rewatch ?? false);
  const [spoiler, setSpoiler] = useState(existing?.spoiler ?? false);
  const [shareWithFollowers, setShareWithFollowers] = useState(true);
  const [visibility, setVisibility] = useState<'Public' | 'Followers'>('Public');
  const [listCount, setListCount] = useState(0);
  const [tagLabel, setTagLabel] = useState('Add tags');
  const [saving, setSaving] = useState(false);
  const saveReviewMutation = trpc.reviews.save.useMutation();
  const deleteReviewMutation = trpc.reviews.delete.useMutation();

  const imageUri = posterPath ? (mediaType === 'book' || posterPath.startsWith('http') ? posterPath : `https://image.tmdb.org/t/p/w342${posterPath}`) : undefined;
  const mediaLabel = mediaType === 'book' ? 'Book' : mediaType === 'tv' ? 'TV Show' : 'Movie';

  const handleSave = async () => {
    const trimmedReview = review.trim();
    if (rating === 0 && !trimmedReview) {
      Alert.alert('Add a rating or review', 'Choose a rating or write a few words before posting.');
      return;
    }
    const watchedDate = date.trim() ? new Date(`${date.trim()}T00:00:00.000Z`) : null;
    if (watchedDate && Number.isNaN(watchedDate.getTime())) {
      Alert.alert('Invalid date', 'Use the YYYY-MM-DD format.');
      return;
    }
    setSaving(true);
    try {
      await saveReviewMutation.mutateAsync({ mediaType, mediaId, title, posterPath: posterPath ?? null, rating, review: trimmedReview, spoiler, watchedDate: watchedDate?.toISOString() ?? null });
      if (mediaType !== 'book') {
        const payload = { mediaType, mediaId, title, posterPath, genreIds, watchedDate: date, rating: rating > 0 ? rating : undefined, review: trimmedReview || undefined, rewatch, spoiler };
        if (existing) lib.updateDiaryEntry(existing.id, payload);
        else lib.addDiaryEntry(payload);
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Could not post review', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert('Delete entry', 'This will remove the review permanently.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteReviewMutation.mutateAsync({ mediaType, mediaId });
          lib.deleteDiaryEntry(existing.id);
          navigation.goBack();
        } catch (error) {
          Alert.alert('Could not delete review', error instanceof Error ? error.message : 'Please try again.');
        }
      } },
    ]);
  };

  const handleTabPress = (tab: MediaTab) => {
    if (tab === mediaType) return;
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.topBar}>
            <Pressable onPress={() => navigation.goBack()} style={styles.closeButton} hitSlop={8} accessibilityLabel="Close review"><Ionicons name="close" size={30} color={colors.text} /></Pressable>
            <Pressable onPress={() => navigation.goBack()} style={styles.searchBar} accessibilityRole="button" accessibilityLabel="Search another title"><Ionicons name="search" size={21} color={colors.textDim} /><Text style={styles.searchText}>Search for movies, TV shows or books...</Text><Ionicons name="scan-outline" size={21} color={colors.accent} /></Pressable>
          </View>

          <Text style={styles.heading}>Create review</Text>
          <Text style={styles.subtitle}>Share your thoughts with your circle</Text>

          <View style={styles.tabs}>
            {tabs.map((tab) => <Pressable key={tab.key} onPress={() => handleTabPress(tab.key)} style={[styles.tab, mediaType === tab.key && styles.tabActive]} accessibilityRole="tab" accessibilityState={{ selected: mediaType === tab.key }}><Ionicons name={tab.icon} size={20} color={mediaType === tab.key ? colors.accent : colors.textDim} /><Text style={[styles.tabText, mediaType === tab.key && styles.tabTextActive]}>{tab.label}</Text></Pressable>)}
          </View>

          <View style={styles.mediaCard}>
            <Image source={{ uri: imageUri }} style={styles.mediaCover} contentFit="cover" />
            <View style={styles.mediaCopy}><Text style={styles.mediaTitle} numberOfLines={2}>{title}</Text><Text style={styles.mediaMeta}>{date.slice(0, 4)} · {mediaLabel}</Text><View style={styles.mediaRating}><Ionicons name="star" size={18} color={colors.gold} /><Text style={styles.mediaRatingText}>{rating > 0 ? rating.toFixed(1) : '—'}</Text></View></View>
            <Pressable onPress={() => navigation.goBack()} style={styles.removeButton} accessibilityLabel="Choose another title"><Ionicons name="close" size={22} color={colors.textDim} /></Pressable>
          </View>

          <View style={styles.section}><Text style={styles.sectionTitle}>Your rating</Text><View style={styles.ratingRow}>{Array.from({ length: 10 }, (_, index) => { const value = index + 1; return <Pressable key={value} onPress={() => setRating(value)} hitSlop={4} accessibilityLabel={`Rate ${value} out of 10`}><Ionicons name={value <= rating ? 'star' : 'star-outline'} size={31} color={value <= rating ? colors.gold : colors.textFaint} /></Pressable>; })}<Text style={styles.ratingValue}>{rating > 0 ? `${rating}/10` : '0/10'}</Text></View><Pressable style={styles.ratingMood} onPress={() => setRating(rating === 10 ? 8 : 10)}><Text style={styles.ratingMoodText}>{rating >= 9 ? 'Masterpiece' : rating >= 7 ? 'Loved it' : 'Choose a rating'} {rating >= 9 ? '♛' : ''}</Text><Ionicons name="chevron-down" size={18} color={colors.textDim} /></Pressable></View>

          <View style={styles.section}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Your review</Text><Text style={styles.counter}>{review.length}/1000</Text></View><TextInput style={styles.reviewInput} value={review} onChangeText={(value) => setReview(value.slice(0, 1000))} placeholder="What did you think about it?" placeholderTextColor={colors.textFaint} multiline textAlignVertical="top" /><View style={styles.chipRow}><Pressable onPress={() => setSpoiler(false)} style={[styles.chip, !spoiler && styles.chipActive]}><Ionicons name="eye-off-outline" size={18} color={!spoiler ? colors.accent : colors.textDim} /><Text style={[styles.chipText, !spoiler && styles.chipTextActive]}>No spoilers</Text></Pressable><Pressable onPress={() => setSpoiler(true)} style={[styles.chip, spoiler && styles.chipActive]}><Ionicons name="warning-outline" size={18} color={spoiler ? colors.accent : colors.textDim} /><Text style={[styles.chipText, spoiler && styles.chipTextActive]}>Spoiler</Text></Pressable><Pressable onPress={() => setTagLabel(tagLabel === 'Add tags' ? 'Personal pick' : 'Add tags')} style={[styles.chip, tagLabel !== 'Add tags' && styles.chipActive]}><Ionicons name="pricetag-outline" size={18} color={tagLabel !== 'Add tags' ? colors.accent : colors.textDim} /><Text style={[styles.chipText, tagLabel !== 'Add tags' && styles.chipTextActive]}>{tagLabel}</Text></Pressable></View></View>

          <View style={styles.section}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Add to lists <Text style={styles.optional}>(optional)</Text></Text><Text style={styles.counter}>{listCount}/5</Text></View><Pressable style={styles.listRow} onPress={() => setListCount((count) => count >= 5 ? 0 : count + 1)}><Text style={styles.listText}>{listCount ? `${listCount} list${listCount > 1 ? 's' : ''} selected` : 'Add or create a list'}</Text><Ionicons name="chevron-forward" size={20} color={colors.textDim} /></Pressable></View>

          <View style={styles.section}><Text style={styles.sectionTitle}>Share to</Text><Text style={styles.shareHint}>Where do you want to share this review?</Text><Pressable style={styles.listRow} onPress={() => setVisibility((value) => value === 'Public' ? 'Followers' : 'Public')}><View style={styles.visibilityCopy}><Ionicons name={visibility === 'Public' ? 'globe-outline' : 'people-outline'} size={20} color={colors.accent} /><View><Text style={styles.listText}>{visibility}</Text><Text style={styles.visibilityHint}>{visibility === 'Public' ? 'Anyone can discover and view' : 'Only your followers can view'}</Text></View></View><Ionicons name="chevron-down" size={19} color={colors.textDim} /></Pressable><View style={styles.shareFollowers}><View><Text style={styles.followersTitle}>Also share to</Text><Text style={styles.visibilityHint}>Your followers</Text></View><Switch value={shareWithFollowers} onValueChange={setShareWithFollowers} trackColor={{ false: colors.surfaceHigh, true: colors.accent }} thumbColor={colors.text} /></View></View>

          <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => [styles.postButton, pressed && styles.postPressed, saving && styles.disabled]}><Ionicons name="send" size={20} color={colors.bg} /><Text style={styles.postText}>{saving ? 'Posting…' : existing ? 'Update review' : 'Post review'}</Text></Pressable>
          {existing ? <Pressable onPress={handleDelete} style={styles.deleteButton}><Ionicons name="trash-outline" size={17} color={colors.danger} /><Text style={styles.deleteText}>Delete review</Text></Pressable> : null}
          <TextInput style={styles.hiddenDate} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textFaint} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xl * 2 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  closeButton: { width: 42, alignItems: 'flex-start', justifyContent: 'center' },
  searchBar: { flex: 1, minHeight: 56, borderRadius: 29, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm },
  searchText: { flex: 1, color: colors.textDim, fontSize: fontSizes.sm },
  heading: { color: colors.text, fontSize: 34, lineHeight: 40, fontWeight: '900', marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  subtitle: { color: colors.textDim, fontSize: fontSizes.md, marginTop: spacing.xs, paddingHorizontal: spacing.lg },
  tabs: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tab: { flex: 1, minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.accent, backgroundColor: 'rgba(31, 215, 171, 0.08)' },
  tabText: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '800' },
  tabTextActive: { color: colors.accent },
  mediaCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  mediaCover: { width: 84, height: 122, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh },
  mediaCopy: { flex: 1, marginLeft: spacing.md, gap: 7 },
  mediaTitle: { color: colors.text, fontSize: 20, lineHeight: 24, fontWeight: '900' },
  mediaMeta: { color: colors.textDim, fontSize: fontSizes.sm },
  mediaRating: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  mediaRatingText: { color: colors.gold, fontSize: fontSizes.md, fontWeight: '900' },
  removeButton: { width: 38, height: 38, borderRadius: 20, borderWidth: 2, borderColor: colors.textDim, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: spacing.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '900' },
  counter: { color: colors.textDim, fontSize: fontSizes.sm },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: 2 },
  ratingValue: { color: colors.text, fontSize: 18, fontWeight: '900', marginLeft: 6 },
  ratingMood: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginTop: spacing.md, paddingHorizontal: spacing.md, minHeight: 50 },
  ratingMoodText: { color: colors.text, fontSize: fontSizes.md, fontWeight: '700' },
  reviewInput: { minHeight: 142, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: fontSizes.md, lineHeight: 22 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 10 },
  chipActive: { borderColor: colors.accent, backgroundColor: 'rgba(31, 215, 171, 0.09)' },
  chipText: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '700' },
  chipTextActive: { color: colors.accent },
  optional: { color: colors.textFaint, fontWeight: '500' },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 60, marginTop: spacing.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  listText: { color: colors.text, fontSize: fontSizes.md, fontWeight: '700' },
  shareHint: { color: colors.textDim, fontSize: fontSizes.sm, marginTop: 4 },
  visibilityCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  visibilityHint: { color: colors.textDim, fontSize: 12, marginTop: 3 },
  shareFollowers: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  followersTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '700' },
  postButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.xl, minHeight: 62, borderRadius: 32, backgroundColor: colors.accent },
  postPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.55 },
  postText: { color: colors.bg, fontSize: 18, fontWeight: '900' },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.lg },
  deleteText: { color: colors.danger, fontWeight: '800' },
  hiddenDate: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});

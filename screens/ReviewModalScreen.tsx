import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import RatingStars from '../components/RatingStars';
import { ContentStackParamList } from '../navigation/types';
import { useLibrary } from '../context/LibraryContext';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type RouteT = RouteProp<ContentStackParamList, 'ReviewModal'>;

export default function ReviewModalScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteT>();
  const { mediaType, mediaId, title, posterPath, genreIds, entryId } = route.params;
  const lib = useLibrary();

  const existing = entryId ? lib.diary.find((e) => e.id === entryId) : undefined;

  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [review, setReview] = useState(existing?.review ?? '');
  const [date, setDate] = useState(existing?.watchedDate ?? new Date().toISOString().slice(0, 10));
  const [rewatch, setRewatch] = useState(existing?.rewatch ?? false);
  const [spoiler, setSpoiler] = useState(existing?.spoiler ?? false);

  const handleSave = () => {
    const payload = {
      mediaType,
      mediaId,
      title,
      posterPath,
      genreIds,
      watchedDate: date,
      rating: rating > 0 ? rating : undefined,
      review: review.trim() ? review.trim() : undefined,
      rewatch,
      spoiler,
    };
    if (existing) {
      lib.updateDiaryEntry(existing.id, payload);
    } else {
      lib.addDiaryEntry(payload);
    }
    navigation.goBack();
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert('Delete entry', 'This will remove the log entry permanently.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          lib.deleteDiaryEntry(existing.id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{existing ? 'Edit Log' : 'Log Entry'}</Text>
          <Pressable onPress={handleSave} hitSlop={8}>
            <Text style={styles.saveText}>Save</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.mediaTitle} numberOfLines={2}>{title}</Text>

          <View style={styles.block}>
            <Text style={styles.label}>Rating</Text>
            <RatingStars rating={rating} size={32} interactive onChange={setRating} />
          </View>

          <View style={styles.block}>
            <Text style={styles.label}>Watched Date</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textFaint}
            />
          </View>

          <View style={[styles.block, styles.switchRow]}>
            <Text style={styles.label}>Rewatch</Text>
            <Switch value={rewatch} onValueChange={setRewatch} trackColor={{ true: colors.accent, false: colors.surfaceHigh }} thumbColor={colors.text} />
          </View>

          <View style={[styles.block, styles.switchRow]}>
            <Text style={styles.label}>Contains Spoilers</Text>
            <Switch value={spoiler} onValueChange={setSpoiler} trackColor={{ true: colors.accent, false: colors.surfaceHigh }} thumbColor={colors.text} />
          </View>

          <View style={styles.block}>
            <Text style={styles.label}>Review</Text>
            <TextInput
              style={styles.textarea}
              value={review}
              onChangeText={setReview}
              placeholder="What did you think?"
              placeholderTextColor={colors.textFaint}
              multiline
              textAlignVertical="top"
            />
          </View>

          {existing && (
            <Pressable style={styles.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={styles.deleteText}>Delete Entry</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelText: { color: colors.textDim, fontSize: fontSizes.md },
  saveText: { color: colors.accent, fontSize: fontSizes.md, fontWeight: '800' },
  headerTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '800' },
  content: { padding: spacing.lg },
  mediaTitle: { color: colors.text, fontSize: fontSizes.xl, fontWeight: '800', marginBottom: spacing.lg },
  block: { marginBottom: spacing.lg },
  label: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '700', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    fontSize: fontSizes.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  textarea: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: fontSizes.md,
    minHeight: 140,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  deleteText: { color: colors.danger, fontWeight: '700', fontSize: fontSizes.md },
});

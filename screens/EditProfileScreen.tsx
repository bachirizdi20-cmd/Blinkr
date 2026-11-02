import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useLibrary, AVATAR_COLORS } from '../context/LibraryContext';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import { trpc } from '../lib/trpc';
import { isStoredMediaUrl, resolveMediaUrl } from '../lib/media-url';

async function prepareAvatarDataUri(uri: string, width?: number, height?: number) {
  const maxSide = 512;
  const ratio = width && height ? Math.min(1, maxSide / Math.max(width, height)) : 1;
  const resizeAction = width && height
    ? { resize: { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) } }
    : { resize: { width: maxSide } };
  const image = await ImageManipulator.manipulateAsync(uri, [resizeAction], {
    compress: 0.82,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!image.base64) throw new Error('تعذر تجهيز الصورة للرفع. اختر صورة أخرى.');
  if (Math.ceil(image.base64.length * 3 / 4) > 5 * 1024 * 1024) {
    throw new Error('حجم الصورة ما زال كبيرًا. اختر صورة أخرى أصغر.');
  }
  return `data:image/jpeg;base64,${image.base64}`;
}

function showProfileMessage(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const lib = useLibrary();
  const accountQuery = trpc.account.me.useQuery(undefined, { retry: false });
  const updateProfileMutation = trpc.account.updateProfile.useMutation();
  const uploadAvatarMutation = trpc.account.uploadAvatar.useMutation();
  const discardAvatarMutation = trpc.account.discardAvatar.useMutation();
  const hydrated = useRef(false);
  const [username, setUsername] = useState(lib.profile.username);
  const [bio, setBio] = useState(lib.profile.bio);
  const [avatarColor, setAvatarColor] = useState(lib.profile.avatarColor);
  const [avatarUri, setAvatarUri] = useState(lib.profile.avatarUri ?? null);
  const [avatarDimensions, setAvatarDimensions] = useState<{ width: number; height: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const remoteProfile = accountQuery.data?.data;
    if (!accountQuery.data || hydrated.current) return;
    hydrated.current = true;
    if (remoteProfile) {
      setUsername(remoteProfile.username || lib.profile.username);
      setBio(remoteProfile.bio ?? '');
      setAvatarUri(remoteProfile.avatarUrl ?? null);
    }
  }, [accountQuery.data, lib.profile.bio, lib.profile.username]);

  const pickAvatar = async () => {
    if (accountQuery.data?.storageConfigured === false) {
      showProfileMessage('رفع الصور غير مهيأ', 'يلزم إعداد تخزين دائم للصور على الخادم قبل رفع صورة جديدة.');
      return;
    }
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          showProfileMessage('إذن الصور مطلوب', 'اسمح لـ Blinkr بالوصول إلى الصور لاختيار صورة الملف الشخصي.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset?.uri) return;
      setAvatarUri(asset.uri);
      setAvatarDimensions({ width: asset.width, height: asset.height });
    } catch (error) {
      showProfileMessage('تعذر اختيار الصورة', error instanceof Error ? error.message : 'حاول مرة أخرى.');
    }
  };

  const handleSave = async () => {
    const cleanUsername = username.trim();
    const cleanBio = bio.trim();
    if (cleanUsername.length < 2 || cleanUsername.length > 64) {
      showProfileMessage('اسم المستخدم غير صالح', 'اكتب اسمًا يتراوح بين حرفين و64 حرفًا.');
      return;
    }
    if (cleanBio.length > 160) {
      showProfileMessage('النبذة طويلة', 'اجعل النبذة 160 حرفًا أو أقل.');
      return;
    }
    if (avatarUri && !isStoredMediaUrl(avatarUri) && accountQuery.data?.storageConfigured === false) {
      showProfileMessage('رفع الصور غير مهيأ', 'تعذر حفظ الصورة لأن تخزين الصور غير مفعّل على الخادم.');
      return;
    }

    setSaving(true);
    let uncommittedAvatarKey: string | null = null;
    try {
      let cloudAvatarUri = avatarUri;
      if (avatarUri && !isStoredMediaUrl(avatarUri)) {
        const dataUri = await prepareAvatarDataUri(avatarUri, avatarDimensions?.width, avatarDimensions?.height);
        const uploaded = await uploadAvatarMutation.mutateAsync({ dataUri });
        cloudAvatarUri = uploaded.url;
        uncommittedAvatarKey = uploaded.key;
      }
      await updateProfileMutation.mutateAsync({ username: cleanUsername, bio: cleanBio, avatarUrl: cloudAvatarUri });
      uncommittedAvatarKey = null;
      lib.updateProfile({ username: cleanUsername, bio: cleanBio, avatarColor, avatarUri: cloudAvatarUri });
      void accountQuery.refetch().catch(() => undefined);
      navigation.goBack();
    } catch (error) {
      if (uncommittedAvatarKey) {
        try {
          await discardAvatarMutation.mutateAsync({ key: uncommittedAvatarKey });
        } catch (cleanupError) {
          console.warn('[Profile] Could not discard an uncommitted avatar', cleanupError);
        }
      }
      console.warn('[Profile] Remote profile update failed', error);
      showProfileMessage('تعذر حفظ الملف الشخصي', error instanceof Error ? error.message : 'تحقق من اتصالك ثم حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const previewUri = resolveMediaUrl(avatarUri);
  const initials = (username.trim().slice(0, 2) || '؟').toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="إلغاء">
            <Text style={styles.cancelText}>إلغاء</Text>
          </Pressable>
          <Text style={styles.headerTitle}>تعديل الملف الشخصي</Text>
          <Pressable onPress={handleSave} hitSlop={8} disabled={saving} accessibilityRole="button">
            {saving ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={styles.saveText}>حفظ</Text>}
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.avatarPreview}>
            <Pressable onPress={pickAvatar} disabled={saving} style={styles.avatarButton} accessibilityLabel="اختيار صورة الملف الشخصي">
              {previewUri ? <Image source={{ uri: previewUri }} style={styles.avatar} contentFit="cover" /> : (
                <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: avatarColor }]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
              <View style={styles.cameraBadge}><Ionicons name="camera" size={16} color={colors.bg} /></View>
            </Pressable>
            <Text style={styles.changePhoto}>اضغط لاختيار صورة</Text>
            {avatarUri ? (
              <Pressable onPress={() => { setAvatarUri(null); setAvatarDimensions(null); }} disabled={saving} style={styles.removePhoto}>
                <Ionicons name="trash-outline" size={15} color={colors.danger} />
                <Text style={styles.removePhotoText}>إزالة الصورة</Text>
              </Pressable>
            ) : null}
          </View>

          {accountQuery.data?.storageConfigured === false ? (
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={18} color={colors.gold} />
              <Text style={styles.warningText}>رفع الصور يحتاج إلى تفعيل تخزين دائم على الخادم. يمكنك تعديل الاسم والنبذة الآن.</Text>
            </View>
          ) : null}

          {accountQuery.data?.storageConfigured && accountQuery.data.storageDeletionSupported === false ? (
            <View style={styles.warningBox}>
              <Ionicons name="information-circle-outline" size={18} color={colors.gold} />
              <Text style={styles.warningText}>مخزن الصور الحالي لا يدعم الحذف النهائي؛ قد تبقى النسخة القديمة محفوظة بعد إزالة الصورة أو استبدالها.</Text>
            </View>
          ) : null}

          <Text style={styles.label}>لون الصورة البديلة</Text>
          <View style={styles.colorRow}>
            {AVATAR_COLORS.map((color) => (
              <Pressable key={color} onPress={() => setAvatarColor(color)} style={[styles.colorDot, { backgroundColor: color }, avatarColor === color && styles.colorDotActive]} accessibilityLabel="اختيار لون الصورة البديلة">
                {avatarColor === color && <Ionicons name="checkmark" size={16} color="#04120C" />}
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>اسم المستخدم</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="اسم المستخدم"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            maxLength={64}
            textAlign="right"
          />

          <Text style={styles.label}>نبذة عنك</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={bio}
            onChangeText={setBio}
            placeholder="ما الأفلام أو المسلسلات التي تحبها؟"
            maxLength={160}
            placeholderTextColor={colors.textFaint}
            multiline
            textAlign="right"
          />
          <Text style={styles.counter}>{bio.length}/160</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  cancelText: { color: colors.textDim, fontSize: fontSizes.md },
  saveText: { color: colors.accent, fontSize: fontSizes.md, fontWeight: '800' },
  headerTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '800', writingDirection: 'rtl' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  avatarPreview: { alignItems: 'center', marginBottom: spacing.xl },
  avatarButton: { position: 'relative' },
  avatar: { width: 104, height: 104, borderRadius: 52 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  cameraBadge: { position: 'absolute', right: 0, bottom: 0, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.bg },
  changePhoto: { color: colors.accent, fontSize: fontSizes.sm, fontWeight: '700', marginTop: spacing.sm },
  removePhoto: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, padding: spacing.xs },
  removePhotoText: { color: colors.danger, fontSize: fontSizes.xs, fontWeight: '700' },
  avatarText: { color: '#04120C', fontSize: fontSizes.xxl, fontWeight: '800' },
  warningBox: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, padding: spacing.md, marginBottom: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  warningText: { flex: 1, color: colors.textDim, fontSize: fontSizes.xs, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl' },
  label: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '700', marginBottom: spacing.sm, textAlign: 'right', writingDirection: 'rtl' },
  colorRow: { flexDirection: 'row-reverse', justifyContent: 'flex-start', gap: spacing.sm, marginBottom: spacing.lg },
  colorDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorDotActive: { borderColor: colors.text },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, color: colors.text, fontSize: fontSizes.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  counter: { color: colors.textFaint, fontSize: 11, textAlign: 'left', marginTop: -spacing.md, marginBottom: spacing.md },
});

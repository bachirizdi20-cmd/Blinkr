import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useLibrary, AVATAR_COLORS } from '../context/LibraryContext';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import { trpc } from '../lib/trpc';
import { getApiBaseUrl } from '../constants/oauth';

async function imageToDataUri(uri: string, mime: string) {
  if (Platform.OS !== 'web') {
    const base64 = await new File(uri).base64();
    return `data:${mime};base64,${base64}`;
  }
  const response = await fetch(uri);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to read selected image'));
    reader.readAsDataURL(blob);
  });
}

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const lib = useLibrary();
  const [username, setUsername] = useState(lib.profile.username);
  const [bio, setBio] = useState(lib.profile.bio);
  const [avatarColor, setAvatarColor] = useState(lib.profile.avatarColor);
  const [avatarUri, setAvatarUri] = useState(lib.profile.avatarUri ?? null);
  const [avatarMime, setAvatarMime] = useState('image/jpeg');
  const [saving, setSaving] = useState(false);
  const updateProfileMutation = trpc.account.updateProfile.useMutation();
  const uploadAvatarMutation = trpc.account.uploadAvatar.useMutation();

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
      setAvatarMime(result.assets[0].mimeType?.startsWith('image/') ? result.assets[0].mimeType : 'image/jpeg');
    }
  };

  const handleSave = async () => {
    const cleanBio = bio.trim();
    if (cleanBio.length > 160) {
      Alert.alert('Bio is too long', 'Keep your bio under 160 characters.');
      return;
    }
    setSaving(true);
    try {
      let cloudAvatarUri = avatarUri;
      if (avatarUri && !/^https?:\/\//i.test(avatarUri) && !avatarUri.startsWith('/manus-storage/')) {
        const dataUri = await imageToDataUri(avatarUri, avatarMime);
        const uploaded = await uploadAvatarMutation.mutateAsync({ dataUri });
        cloudAvatarUri = uploaded.url.startsWith('/') ? `${getApiBaseUrl()}${uploaded.url}` : uploaded.url;
      }
      const nextProfile = { username: username.trim() || 'cinephile', bio: cleanBio, avatarColor, avatarUri: cloudAvatarUri };
      lib.updateProfile(nextProfile);
      await updateProfileMutation.mutateAsync({ username: nextProfile.username, bio: nextProfile.bio, avatarUrl: cloudAvatarUri });
      navigation.goBack();
    } catch (error) {
      console.warn('[Profile] Remote profile update failed', error);
      Alert.alert('Could not save profile', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <Pressable onPress={handleSave} hitSlop={8} disabled={saving}>
            <Text style={[styles.saveText, saving && { opacity: 0.5 }]}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.avatarPreview}>
            <Pressable onPress={pickAvatar} style={styles.avatarButton} accessibilityLabel="Change profile photo">
              {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" /> : (
                <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                  <Text style={styles.avatarText}>{(username.slice(0, 2) || 'ME').toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.cameraBadge}><Ionicons name="camera" size={15} color={colors.bg} /></View>
            </Pressable>
            <Text style={styles.changePhoto}>Change photo</Text>
          </View>

          <Text style={styles.label}>Avatar Color</Text>
          <View style={styles.colorRow}>
            {AVATAR_COLORS.map((c) => (
              <Pressable key={c} onPress={() => setAvatarColor(c)} style={[styles.colorDot, { backgroundColor: c }, avatarColor === c && styles.colorDotActive]}>
                {avatarColor === c && <Ionicons name="checkmark" size={16} color="#04120C" />}
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Username</Text>
          <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="Username" placeholderTextColor={colors.textFaint} autoCapitalize="none" />

          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people what you love to watch"
            maxLength={160}
            placeholderTextColor={colors.textFaint}
            multiline
          />
          <Text style={styles.counter}>{bio.length}/160</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  cancelText: { color: colors.textDim, fontSize: fontSizes.md },
  saveText: { color: colors.accent, fontSize: fontSizes.md, fontWeight: '800' },
  headerTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '800' },
  content: { padding: spacing.lg },
  avatarPreview: { alignItems: 'center', marginBottom: spacing.xl },
  avatarButton: { position: 'relative' },
  avatar: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  cameraBadge: { position: 'absolute', right: -2, bottom: 0, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.bg },
  changePhoto: { color: colors.accent, fontSize: fontSizes.sm, fontWeight: '700', marginTop: spacing.sm },
  avatarText: { color: '#04120C', fontSize: fontSizes.xxl, fontWeight: '800' },
  label: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '700', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.4 },
  colorRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  colorDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorDotActive: { borderColor: colors.text },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, color: colors.text, fontSize: fontSizes.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  counter: { color: colors.textFaint, fontSize: 11, textAlign: 'right', marginTop: -spacing.md, marginBottom: spacing.md },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useLibrary, AVATAR_COLORS } from '../context/LibraryContext';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const lib = useLibrary();
  const [username, setUsername] = useState(lib.profile.username);
  const [bio, setBio] = useState(lib.profile.bio);
  const [avatarColor, setAvatarColor] = useState(lib.profile.avatarColor);

  const handleSave = () => {
    lib.updateProfile({ username: username.trim() || 'cinephile', bio: bio.trim(), avatarColor });
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <Pressable onPress={handleSave} hitSlop={8}>
            <Text style={styles.saveText}>Save</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.avatarPreview}>
            <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarText}>{(username.slice(0, 2) || 'ME').toUpperCase()}</Text>
            </View>
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
            placeholderTextColor={colors.textFaint}
            multiline
          />
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
  avatar: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#04120C', fontSize: fontSizes.xxl, fontWeight: '800' },
  label: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '700', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.4 },
  colorRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  colorDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorDotActive: { borderColor: colors.text },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, color: colors.text, fontSize: fontSizes.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
});

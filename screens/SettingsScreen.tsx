import React from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ContentStackParamList } from '../navigation/types';
import { useAuth } from '../hooks/use-auth';
import { trpc } from '../lib/trpc';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const accountQuery = trpc.account.me.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const requestVerification = trpc.auth.requestVerification.useMutation();
  const emailVerified = Boolean((accountQuery.data?.user as { emailVerifiedAt?: Date | null } | undefined)?.emailVerifiedAt);

  const sendVerification = async () => {
    try {
      await requestVerification.mutateAsync();
      Alert.alert('تم إرسال رسالة التحقق', 'افتح بريدك الإلكتروني واتبع رابط التحقق.');
    } catch {
      Alert.alert('تعذّر إرسال الرسالة', 'حاول مرة أخرى لاحقًا.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="رجوع">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>الإعدادات</Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>الحساب</Text>
        <View style={styles.accountCard}>
          <View style={styles.accountIcon}><Ionicons name="person-outline" size={21} color={colors.accent} /></View>
          <View style={styles.accountCopy}>
            <Text style={styles.accountName}>{user?.name || 'حساب Blinkr'}</Text>
            <Text style={styles.accountEmail}>{user?.email || 'لا يوجد بريد إلكتروني'}</Text>
          </View>
        </View>
        {user?.email && !emailVerified ? (
          <Pressable style={styles.verifyRow} onPress={sendVerification} disabled={requestVerification.isPending}>
            {requestVerification.isPending ? <ActivityIndicator size="small" color={colors.accent} /> : <Ionicons name="mail-outline" size={20} color={colors.accent} />}
            <Text style={styles.verifyText}>{requestVerification.isPending ? 'جارٍ إرسال الرابط…' : 'إرسال رابط التحقق إلى البريد'}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        ) : null}

        <Text style={[styles.sectionTitle, styles.sectionGap]}>التفضيلات</Text>
        <SettingRow icon="create-outline" label="تعديل الملف الشخصي" onPress={() => navigation.navigate('EditProfile')} />
        <SettingRow icon="notifications-outline" label="الإشعارات" onPress={() => navigation.navigate('Notifications')} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]} onPress={onPress}>
      <Ionicons name={icon} size={21} color={colors.text} />
      <Text style={styles.settingLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '800', writingDirection: 'rtl' },
  content: { padding: spacing.lg },
  sectionTitle: { color: colors.textDim, fontSize: fontSizes.sm, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl', marginBottom: spacing.sm },
  sectionGap: { marginTop: spacing.xl },
  accountCard: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  accountIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  accountCopy: { flex: 1, alignItems: 'flex-end' },
  accountName: { color: colors.text, fontSize: fontSizes.md, fontWeight: '800', textAlign: 'right' },
  accountEmail: { color: colors.textDim, fontSize: fontSizes.xs, marginTop: 4, textAlign: 'right' },
  verifyRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  verifyText: { color: colors.accent, fontSize: fontSizes.sm, fontWeight: '700', flex: 1, textAlign: 'right', writingDirection: 'rtl' },
  settingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  settingLabel: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '700', flex: 1, textAlign: 'right', writingDirection: 'rtl' },
  pressed: { opacity: 0.7 },
});

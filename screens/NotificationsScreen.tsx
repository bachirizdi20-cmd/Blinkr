import React, { useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/use-auth';
import { ContentStackParamList } from '../navigation/types';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import GeneralErrorState from '../components/GeneralErrorState';

type Nav = NativeStackNavigationProp<ContentStackParamList>;

const COPY = {
  follow: 'بدأ بمتابعتك',
  like: 'أعجب بمراجعتك',
  comment: 'علّق على مراجعتك',
} as const;

export default function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const query = trpc.social.notifications.useQuery(undefined, { enabled: Boolean(user) });
  const markRead = trpc.social.markNotificationsRead.useMutation({ onSuccess: () => query.refetch() });

  useEffect(() => {
    if (user && query.data?.some((item) => !item.readAt)) markRead.mutate();
  }, [user, query.data]);

  if (query.isLoading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.accent} style={styles.loader} /></SafeAreaView>;
  if (query.isError) return <SafeAreaView style={styles.safe}><GeneralErrorState title="Unable to load notifications" message={query.error.message} onRetry={() => query.refetch()} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>
      <FlatList
        data={query.data ?? []}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />}
        contentContainerStyle={(query.data?.length ?? 0) === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="notifications-off-outline" size={38} color={colors.textFaint} /><Text style={styles.emptyTitle}>No notifications yet</Text><Text style={styles.emptyText}>Likes, comments, and follows will appear here.</Text></View>}
        renderItem={({ item }) => (
          <View style={[styles.row, !item.readAt && styles.unread]}>
            <View style={styles.icon}><Ionicons name={item.kind === 'follow' ? 'person-add-outline' : item.kind === 'like' ? 'heart-outline' : 'chatbubble-outline'} size={20} color={colors.accent} /></View>
            <View style={styles.copy}><Text style={styles.text}>{COPY[item.kind]}.</Text><Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text></View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  title: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '800' },
  loader: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.sm },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  unread: { borderColor: colors.accent },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh },
  copy: { flex: 1 },
  text: { color: colors.text, fontSize: fontSizes.md, fontWeight: '700' },
  date: { color: colors.textFaint, fontSize: fontSizes.xs, marginTop: 3 },
  empty: { alignItems: 'center', padding: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '800', marginTop: spacing.md },
  emptyText: { color: colors.textDim, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
});

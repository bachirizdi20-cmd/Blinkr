import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import UserAvatar from '../components/UserAvatar';
import EmptyState from '../components/EmptyState';
import { ContentStackParamList } from '../navigation/types';
import { useSocial } from '../context/SocialContext';
import { ChatMessage } from '../types/social';
import { formatMessageTime } from '../lib/format';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/use-auth';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type RouteT = RouteProp<ContentStackParamList, 'Conversation'>;

export default function ConversationScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { userId } = route.params;
  const numericOtherUserId = Number(String(userId).replace(/^remote-/, ''));
  const social = useSocial();
  const { user: authUser } = useAuth();
  const messagesQuery = trpc.social.messages.useQuery({ otherUserId: numericOtherUserId }, { enabled: Boolean(authUser), retry: 1 });
  const sendMessageMutation = trpc.social.sendMessage.useMutation({ onSuccess: () => messagesQuery.refetch() });
  const sendImageMutation = trpc.social.sendImage.useMutation({ onSuccess: () => messagesQuery.refetch() });
  const user = social.getUser(userId);
  const convo = social.getConversation(userId);
  const isTyping = !!social.typingUserIds[userId];
  const [text, setText] = useState('');
  const [pendingImage, setPendingImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const listRef = useRef<FlatList>(null);

  useFocusEffect(
    React.useCallback(() => {
      social.markRead(userId);
    }, [userId])
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState icon="alert-circle-outline" title="User not found" />
      </SafeAreaView>
    );
  }

  const handleSend = async () => {
    if (!text.trim() || sendMessageMutation.isPending) return;
    try {
      if (authUser) await sendMessageMutation.mutateAsync({ otherUserId: numericOtherUserId, text: text.trim() });
      else social.sendMessage(userId, text);
      setText('');
    } catch { Alert.alert('Could not send message', 'Please try again.'); }
  };

  const handlePickImage = async (fromCamera: boolean) => {
    try {
      if (fromCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.status !== 'granted') { Alert.alert('Camera permission needed', 'Allow camera access to take a photo.'); return; }
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.72 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.72 });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 8_000_000) { Alert.alert('Image too large', 'Choose an image smaller than 8 MB.'); return; }
      if (!authUser) { Alert.alert('Sign in required', 'Sign in to send photos.'); return; }
      setPendingImage(asset);
    } catch { Alert.alert('Could not select image', 'Please try again.'); }
  };

  const handleSendImage = async () => {
    if (!pendingImage || !authUser || sendImageMutation.isPending) return;
    try {
      const base64 = await FileSystem.readAsStringAsync(pendingImage.uri, { encoding: FileSystem.EncodingType.Base64 });
      await sendImageMutation.mutateAsync({ otherUserId: numericOtherUserId, base64, mimeType: pendingImage.mimeType === 'image/png' ? 'image/png' : 'image/jpeg', size: pendingImage.fileSize ?? base64.length });
      setPendingImage(null);
    } catch { Alert.alert('Could not send image', 'Please try again.'); }
  };

  const handleDelete = () => {
    Alert.alert('Delete conversation', `Remove your chat with ${user.displayName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          social.deleteConversation(userId);
          navigation.goBack();
        },
      },
    ]);
  };

  const remoteMessages = (messagesQuery.data ?? []).map((item: any) => ({ ...item, id: String(item.id), sender: item.senderId === Number(authUser?.id) ? 'me' : 'them', createdAt: new Date(item.createdAt), text: item.text ?? '' }));
  const data = remoteMessages.length ? remoteMessages : [...convo.messages].reverse();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable style={styles.headerCenter} onPress={() => navigation.navigate('UserProfile', { userId })}>
          <UserAvatar name={user.displayName} color={user.avatarColor} size={34} />
          <View>
            <Text style={styles.headerName}>{user.displayName}</Text>
            <Text style={styles.headerStatus}>{isTyping ? 'typing…' : user.followsYou ? 'Follows you' : `@${user.username}`}</Text>
          </View>
        </Pressable>
        <Pressable onPress={handleDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={20} color={colors.textFaint} />
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        {data.length === 0 ? (
          <View style={{ flex: 1 }}>
            <EmptyState icon="chatbubble-ellipses-outline" title={`Say hi to ${user.displayName}`} message={user.bio} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={data}
            inverted
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesContent}
            renderItem={({ item }: { item: ChatMessage }) => {
              const mine = item.sender === 'me';
              return (
                <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    {!!(item as any).sharedMediaId && <Pressable style={styles.mediaCard} onPress={() => navigation.navigate('Detail', { mediaType: (item as any).sharedMediaType, id: Number((item as any).sharedMediaId) })}><Image source={{ uri: (item as any).sharedPosterPath ? `https://image.tmdb.org/t/p/w300${(item as any).sharedPosterPath}` : undefined }} style={styles.cardPoster} resizeMode="cover" /><View style={styles.cardCopy}><Text style={styles.cardLabel}>Shared from TMDB</Text><Text style={styles.cardTitle} numberOfLines={2}>{(item as any).sharedTitle}</Text><Text style={styles.cardRating}>★ {(((item as any).sharedRating ?? 0) / 10).toFixed(1)}</Text></View></Pressable>}
                    {!!(item as any).mediaUrl && <Image source={{ uri: (item as any).mediaUrl }} style={styles.messageImage} resizeMode="cover" />}
                    {!!item.text && <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.text}</Text>}
                  </View>
                  <Text style={[styles.bubbleTime, mine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                    {formatMessageTime(item.createdAt)}
                  </Text>
                </View>
              );
            }}
            ListHeaderComponent={
              isTyping ? (
                <View style={[styles.bubbleRow, styles.bubbleRowTheirs]}>
                  <View style={[styles.bubble, styles.bubbleTheirs, styles.typingBubble]}>
                    <Text style={styles.typingDots}>•••</Text>
                  </View>
                </View>
              ) : null
            }
          />
        )}

        {pendingImage ? <View style={styles.previewBar}><Image source={{ uri: pendingImage.uri }} style={styles.previewImage} /><View style={styles.previewCopy}><Text style={styles.previewTitle}>Ready to send</Text><Text style={styles.previewMeta}>{pendingImage.width} × {pendingImage.height}</Text></View><Pressable onPress={() => setPendingImage(null)} style={styles.previewCancel}><Ionicons name="close" size={19} color={colors.textDim} /></Pressable><Pressable onPress={handleSendImage} style={styles.previewSend} disabled={sendImageMutation.isPending}><Ionicons name="send" size={16} color="#04120C" /></Pressable></View> : null}
        <View style={styles.inputBar}>
          <Pressable style={styles.attachBtn} onPress={() => Alert.alert('Send photo', 'Choose a source', [{ text: 'Camera', onPress: () => handlePickImage(true) }, { text: 'Photo library', onPress: () => handlePickImage(false) }, { text: 'Cancel', style: 'cancel' }])} disabled={sendImageMutation.isPending} accessibilityLabel="Send photo">
            {sendImageMutation.isPending ? <ActivityIndicator size="small" color={colors.accent} /> : <Ionicons name="image-outline" size={21} color={colors.textDim} />}
          </Pressable>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={`Message ${user.displayName}`}
            placeholderTextColor={colors.textFaint}
            multiline
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <Pressable style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]} onPress={handleSend} disabled={!text.trim()}>
            <Ionicons name="send" size={17} color={text.trim() ? '#04120C' : colors.textFaint} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerName: { color: colors.text, fontSize: fontSizes.md, fontWeight: '800' },
  headerStatus: { color: colors.textFaint, fontSize: 11, marginTop: 1 },
  messagesContent: { padding: spacing.lg, gap: spacing.sm },
  bubbleRow: { marginBottom: spacing.sm, maxWidth: '80%' },
  bubbleRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleRowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  bubbleMine: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.surfaceHigh, borderBottomLeftRadius: 4 },
  bubbleText: { color: colors.text, fontSize: fontSizes.md, lineHeight: 20 },
  bubbleTextMine: { color: '#04120C', fontWeight: '600' },
  bubbleTime: { fontSize: 10, marginTop: 3, marginHorizontal: 4 },
  bubbleTimeMine: { color: colors.textFaint },
  bubbleTimeTheirs: { color: colors.textFaint },
  typingBubble: { paddingVertical: spacing.sm },
  typingDots: { color: colors.textDim, fontSize: fontSizes.lg, letterSpacing: 1 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  previewBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  previewImage: { width: 48, height: 48, borderRadius: radius.sm },
  previewCopy: { flex: 1 },
  previewTitle: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '800' },
  previewMeta: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  previewCancel: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh },
  previewSend: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  attachBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh },
  mediaCard: { flexDirection: 'row', width: 245, minHeight: 118, overflow: 'hidden', borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  cardPoster: { width: 76, height: 118, backgroundColor: colors.surfaceHigh },
  cardCopy: { flex: 1, padding: spacing.sm, justifyContent: 'center' },
  cardLabel: { color: colors.textFaint, fontSize: 10, fontWeight: '700', marginBottom: 4 },
  cardTitle: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '800', lineHeight: 18 },
  cardRating: { color: colors.accent, fontSize: 12, fontWeight: '800', marginTop: 7 },
  messageImage: { width: 190, height: 190, borderRadius: radius.md, marginBottom: spacing.xs },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    fontSize: fontSizes.md,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.surfaceHigh },
});

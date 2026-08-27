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
  Modal,
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
  const [failedCard, setFailedCard] = useState<any>(null);
  const shareMediaMutation = trpc.social.shareMedia.useMutation({ onSuccess: () => { setFailedCard(null); messagesQuery.refetch(); setCardPickerOpen(false); setCardSearch(''); }, onError: (_error, variables) => setFailedCard(variables) });
  const [cardPickerOpen, setCardPickerOpen] = useState(false);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [cardSearch, setCardSearch] = useState('');
  const cardSearchQuery = trpc.tmdb.get.useQuery({ path: '/search/multi', params: { query: cardSearch, include_adult: false } }, { enabled: cardPickerOpen && cardSearch.trim().length >= 2, retry: 1 });
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
        <View style={styles.headerActions}>
          <Pressable onPress={() => Alert.alert('Search messages', 'Message search will be available here.')} hitSlop={8} accessibilityLabel="Search messages">
            <Ionicons name="search-outline" size={20} color={colors.textDim} />
          </Pressable>
          <Pressable onPress={() => Alert.alert('Conversation options', undefined, [{ text: 'Delete conversation', style: 'destructive', onPress: handleDelete }, { text: 'Cancel', style: 'cancel' }])} hitSlop={8} accessibilityLabel="Conversation options">
            <Ionicons name="ellipsis-vertical" size={20} color={colors.textDim} />
          </Pressable>
        </View>
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
          <Pressable style={({ pressed }) => [styles.attachBtn, pressed && styles.iconBtnPressed]} onPress={() => setAttachmentOpen(true)} accessibilityLabel="Open attachment menu">
            <Ionicons name="add" size={24} color={colors.textDim} />
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
          <Pressable style={({ pressed }) => [styles.emojiBtn, pressed && styles.iconBtnPressed]} onPress={() => setText((current) => `${current}${current ? ' ' : ''}😊`)} accessibilityLabel="Add emoji">
            <Ionicons name="happy-outline" size={20} color={colors.textDim} />
          </Pressable>
          {text.trim() ? <Pressable style={({ pressed }) => [styles.sendBtn, pressed && styles.sendBtnPressed]} onPress={handleSend} accessibilityLabel="Send message">
            <Ionicons name="arrow-up" size={19} color="#04120C" />
          </Pressable> : <Pressable style={({ pressed }) => [styles.voiceBtn, pressed && styles.sendBtnPressed]} onPress={() => Alert.alert('Voice message', 'Voice recording is not enabled yet. You can send a photo or movie card from the + menu.')} accessibilityLabel="Voice message">
            <Ionicons name="mic" size={19} color={colors.bg} />
          </Pressable>}
        </View>
      </KeyboardAvoidingView>
      <Modal visible={cardPickerOpen} animationType="slide" transparent onRequestClose={() => setCardPickerOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.cardPicker}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Share a film or series</Text><Pressable onPress={() => setCardPickerOpen(false)}><Ionicons name="close" size={22} color={colors.text} /></Pressable></View><TextInput autoFocus value={cardSearch} onChangeText={setCardSearch} placeholder="Search TMDB..." placeholderTextColor={colors.textFaint} style={styles.cardSearchInput} />{failedCard ? <View style={styles.retryRow}><Text style={styles.retryText}>Could not share the card.</Text><Pressable onPress={() => shareMediaMutation.mutate(failedCard)} disabled={shareMediaMutation.isPending}><Text style={styles.retryAction}>Retry</Text></Pressable></View> : null}{cardSearchQuery.isLoading ? <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} /> : <FlatList data={(((cardSearchQuery.data as any)?.results ?? [])).filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')} keyExtractor={(item: any) => `${item.media_type}-${item.id}`} contentContainerStyle={{ paddingBottom: spacing.lg }} ListEmptyComponent={cardSearch.length >= 2 ? <EmptyState icon="search-outline" title="No titles found" message="Try another title." /> : <EmptyState icon="film-outline" title="Search for a title" message="Find a movie or series to share." />} renderItem={({ item }: { item: any }) => <Pressable style={styles.cardResult} disabled={shareMediaMutation.isPending} onPress={() => shareMediaMutation.mutate({ otherUserId: numericOtherUserId, mediaType: item.media_type, mediaId: item.id, title: item.title, posterPath: item.posterPath, rating: item.voteAverage ?? 0, overview: item.overview ?? null })}><Image source={{ uri: item.posterPath ? `https://image.tmdb.org/t/p/w200${item.posterPath}` : undefined }} style={styles.resultPoster} /><View style={styles.resultCopy}><Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text><Text style={styles.resultMeta}>{item.media_type === 'tv' ? 'Series' : 'Film'} · ★ {(item.voteAverage ?? 0).toFixed(1)}</Text></View>{shareMediaMutation.isPending ? <ActivityIndicator color={colors.accent} /> : <Ionicons name="paper-plane-outline" size={18} color={colors.accent} />}</Pressable>} />}</View></View>
      </Modal>
      <Modal visible={attachmentOpen} transparent animationType="slide" onRequestClose={() => setAttachmentOpen(false)}>
        <View style={styles.attachmentBackdrop}>
          <Pressable style={styles.attachmentDismiss} onPress={() => setAttachmentOpen(false)} accessibilityLabel="Close attachment menu" />
          <View style={styles.attachmentSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Share something</Text>
            <View style={styles.attachmentGrid}>
              <Pressable style={styles.attachmentItem} onPress={() => { setAttachmentOpen(false); setCardPickerOpen(true); }}><View style={[styles.attachmentIcon, { backgroundColor: 'rgba(53, 211, 153, 0.16)' }]}><Ionicons name="film" size={22} color={colors.accent} /></View><Text style={styles.attachmentLabel}>Share a movie</Text></Pressable>
              <Pressable style={styles.attachmentItem} onPress={() => { setAttachmentOpen(false); Alert.alert('Share a review', 'Open a movie from Create or Details to write and share a review.'); }}><View style={[styles.attachmentIcon, { backgroundColor: 'rgba(255, 195, 80, 0.16)' }]}><Ionicons name="star" size={22} color={colors.gold} /></View><Text style={styles.attachmentLabel}>Share a review</Text></Pressable>
              <Pressable style={styles.attachmentItem} onPress={() => { setAttachmentOpen(false); Alert.alert('Share watchlist', 'Watchlist sharing will be available when a saved list is selected.'); }}><View style={[styles.attachmentIcon, { backgroundColor: 'rgba(80, 160, 255, 0.16)' }]}><Ionicons name="bookmark" size={22} color="#62B2FF" /></View><Text style={styles.attachmentLabel}>Share watchlist</Text></Pressable>
              <Pressable style={styles.attachmentItem} onPress={() => { setAttachmentOpen(false); Alert.alert('Send photo', 'Choose a source', [{ text: 'Camera', onPress: () => handlePickImage(true) }, { text: 'Photo library', onPress: () => handlePickImage(false) }, { text: 'Cancel', style: 'cancel' }]); }}><View style={[styles.attachmentIcon, { backgroundColor: 'rgba(91, 178, 255, 0.16)' }]}><Ionicons name="image" size={22} color="#62B2FF" /></View><Text style={styles.attachmentLabel}>Send photo</Text></Pressable>
              <Pressable style={styles.attachmentItem} onPress={() => { setAttachmentOpen(false); Alert.alert('Send GIF', 'GIF sharing is not enabled yet.'); }}><View style={[styles.attachmentIcon, { backgroundColor: 'rgba(146, 91, 255, 0.18)' }]}><Text style={styles.gifLabel}>GIF</Text></View><Text style={styles.attachmentLabel}>Send GIF</Text></Pressable>
              <Pressable style={styles.attachmentItem} onPress={() => { setAttachmentOpen(false); Alert.alert('Voice message', 'Voice recording is not enabled yet.'); }}><View style={[styles.attachmentIcon, { backgroundColor: 'rgba(255, 126, 58, 0.16)' }]}><Ionicons name="mic" size={22} color="#FF8A4C" /></View><Text style={styles.attachmentLabel}>Voice message</Text></Pressable>
              <Pressable style={styles.attachmentItem} onPress={() => { setAttachmentOpen(false); Alert.alert('Share list', 'List sharing will be available when a saved list is selected.'); }}><View style={[styles.attachmentIcon, { backgroundColor: 'rgba(53, 211, 153, 0.16)' }]}><Ionicons name="list" size={22} color={colors.accent} /></View><Text style={styles.attachmentLabel}>Share list</Text></Pressable>
              <Pressable style={styles.attachmentItem} onPress={() => { setAttachmentOpen(false); Alert.alert('More options', 'More sharing options will appear here.'); }}><View style={[styles.attachmentIcon, { backgroundColor: 'rgba(140, 151, 170, 0.2)' }]}><Ionicons name="ellipsis-horizontal" size={22} color={colors.textDim} /></View><Text style={styles.attachmentLabel}>More</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
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
  attachBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  iconBtnPressed: { opacity: 0.68, transform: [{ scale: 0.95 }] },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  cardPicker: { maxHeight: '82%', backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: spacing.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  modalTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '800' },
  cardSearchInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, paddingHorizontal: spacing.md, height: 44, marginBottom: spacing.md },
  cardResult: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginBottom: spacing.sm },
  resultPoster: { width: 48, height: 70, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh },
  resultCopy: { flex: 1 },
  resultTitle: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '800' },
  resultMeta: { color: colors.textDim, fontSize: 11, marginTop: 5 },
  retryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,80,100,0.12)', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  retryText: { color: colors.textDim, fontSize: 12 },
  retryAction: { color: colors.accent, fontWeight: '800', fontSize: 12 },
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
  emojiBtn: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' },
  voiceBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  attachmentBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.64)' },
  attachmentDismiss: { flex: 1 },
  attachmentSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl, borderTopWidth: 1, borderColor: colors.border },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: colors.textFaint, alignSelf: 'center', marginBottom: spacing.md },
  sheetTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '900', marginBottom: spacing.lg },
  attachmentGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.lg },
  attachmentItem: { width: '23%', alignItems: 'center', gap: spacing.xs },
  attachmentIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  attachmentLabel: { color: colors.textDim, fontSize: 10, lineHeight: 13, textAlign: 'center' },
  gifLabel: { color: '#C9A2FF', fontSize: 13, fontWeight: '900' },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  sendBtnPressed: { opacity: 0.82, transform: [{ scale: 0.94 }] },
});

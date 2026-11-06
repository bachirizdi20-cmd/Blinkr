import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { searchGiphy, GiphyGif } from '../lib/giphy';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import UserAvatar from '../components/UserAvatar';
import EmptyState from '../components/EmptyState';
import ApiErrorState from '../components/ApiErrorState';
import { ContentStackParamList } from '../navigation/types';
import { ChatMessage, MockUser } from '../types/social';
import { formatMessageTime } from '../lib/format';
import { colors, fontSizes, radius, spacing } from '../lib/theme';
import { resolveMediaUrl } from '../lib/media-url';
import { catalogPosterUrl, normalizeReviewMediaType, openCatalogItem } from '../lib/catalog-navigation';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { createAudioPlayer, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/use-auth';
import { PlatformAlert as Alert } from '../lib/platform-alert';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type RouteT = RouteProp<ContentStackParamList, 'Conversation'>;
type AudioDraft = { base64: string; mimeType: 'audio/m4a' | 'audio/mp4' | 'audio/webm' | 'audio/mpeg'; size: number };

async function readUriAsBase64(uri: string): Promise<string> {
  if (Platform.OS !== 'web') {
    return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  }
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`تعذرت قراءة المرفق (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

export default function ConversationScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { userId } = route.params;
  const parsedOtherUserId = Number(String(userId).replace(/^remote-/, ''));
  const numericOtherUserId = Number.isInteger(parsedOtherUserId) && parsedOtherUserId > 0 ? parsedOtherUserId : 0;
  const isRemoteConversation = numericOtherUserId > 0 && String(userId).startsWith('remote-');
  const { user: authUser } = useAuth();
  const remoteProfileQuery = trpc.social.profile.useQuery({ userId: numericOtherUserId }, { enabled: Boolean(authUser && isRemoteConversation), retry: 1 });
  const messagesQuery = trpc.social.messages.useQuery({ otherUserId: numericOtherUserId }, { enabled: Boolean(authUser && isRemoteConversation), retry: 1, refetchInterval: 3000 });
  const sendMessageMutation = trpc.social.sendMessage.useMutation({ onSuccess: () => messagesQuery.refetch() });
  const sendImageMutation = trpc.social.sendImage.useMutation({ onSuccess: () => messagesQuery.refetch() });
  const sendAttachmentMutation = trpc.social.sendAttachment.useMutation({ onSuccess: () => messagesQuery.refetch() });
  const deleteConversationMutation = trpc.social.deleteConversation.useMutation({ onSuccess: () => navigation.goBack() });
  const [failedCard, setFailedCard] = useState<any>(null);
  const shareMediaMutation = trpc.social.shareMedia.useMutation({ onSuccess: () => { setFailedCard(null); messagesQuery.refetch(); setCardPickerOpen(false); setCardSearch(''); }, onError: (_error, variables) => setFailedCard(variables) });
  const [cardPickerOpen, setCardPickerOpen] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifResults, setGifResults] = useState<GiphyGif[]>([]);
  const [gifOffset, setGifOffset] = useState(0);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);
  const [failedGif, setFailedGif] = useState<GiphyGif | null>(null);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const [cardSearch, setCardSearch] = useState('');
  const cardSearchQuery = trpc.tmdb.get.useQuery({ path: '/search/multi', params: { query: cardSearch, include_adult: false } }, { enabled: cardPickerOpen && cardSearch.trim().length >= 2, retry: 1 });
  const remoteUser = useMemo<MockUser | undefined>(() => {
    const item = remoteProfileQuery.data;
    if (!item) return undefined;
    return {
      id: `remote-${item.id}`,
      username: item.username ?? `user${item.id}`,
      displayName: item.name ?? item.username ?? 'مستخدم Blinkr',
      bio: item.bio ?? '',
      avatarUrl: item.avatarUrl,
      avatarColor: colors.accent,
      favoriteGenre: '',
      followsYou: Boolean(item.followsYou),
    };
  }, [remoteProfileQuery.data]);
  const user = remoteUser;
  const isTyping = false;
  const [text, setText] = useState('');
  const [pendingImage, setPendingImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [failedAudio, setFailedAudio] = useState<AudioDraft | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 250);
  const audioPlayerRef = useRef<any>(null);

  useFocusEffect(
    React.useCallback(() => {
      if (isRemoteConversation) void messagesQuery.refetch();
    }, [isRemoteConversation, messagesQuery.refetch])
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="رجوع"><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
          <Text style={styles.headerName}>المحادثة</Text>
        </View>
        {remoteProfileQuery.isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}><ActivityIndicator color={colors.accent} /><Text style={{ color: colors.textDim, fontSize: fontSizes.sm }}>جارٍ تحميل الملف…</Text></View>
        ) : remoteProfileQuery.isError ? (
          <ApiErrorState message="تعذر تحميل بيانات المستخدم." onRetry={() => void remoteProfileQuery.refetch()} />
        ) : (
          <EmptyState icon="alert-circle-outline" title="المستخدم غير متاح" message="قد يكون الحساب قد حُذف أو لم يعد متاحًا." />
        )}
      </SafeAreaView>
    );
  }

  const handleSend = async () => {
    if (!text.trim() || sendMessageMutation.isPending) return;
    try {
      if (!authUser || !isRemoteConversation) return;
      await sendMessageMutation.mutateAsync({ otherUserId: numericOtherUserId, text: text.trim() });
      setText('');
    } catch { Alert.alert('تعذر إرسال الرسالة', 'حاول مرة أخرى.'); }
  };

  const handlePickImage = async (fromCamera: boolean) => {
    try {
      if (fromCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.status !== 'granted') { Alert.alert('إذن الكاميرا مطلوب', 'اسمح باستخدام الكاميرا لالتقاط صورة.'); return; }
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.72 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.72 });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 8_000_000) { Alert.alert('الصورة كبيرة جدًا', 'اختر صورة يقل حجمها عن 8 ميغابايت.'); return; }
      if (!authUser) { Alert.alert('يلزم تسجيل الدخول', 'سجّل الدخول لإرسال الصور.'); return; }
      setPendingImage(asset);
    } catch { Alert.alert('تعذر اختيار الصورة', 'حاول مرة أخرى.'); }
  };

  const loadGifs = async (query = gifSearch, offset = 0, replace = true) => {
    if (gifLoading) return;
    setGifLoading(true);
    setGifError(null);
    try {
      const results = await searchGiphy(query, offset);
      setGifResults((current) => replace ? results : [...current, ...results]);
      setGifOffset(offset + results.length);
    } catch (error) {
      setGifError(error instanceof Error ? error.message : 'تعذر تحميل صور GIF.');
    } finally {
      setGifLoading(false);
    }
  };

  const openGifPicker = () => {
    setAttachmentOpen(false);
    setGifPickerOpen(true);
    setGifSearch('');
    setGifOffset(0);
    void loadGifs('', 0, true);
  };

  const handleSearchGifs = () => {
    setGifOffset(0);
    void loadGifs(gifSearch, 0, true);
  };

  const handleSelectGiphy = async (gif: GiphyGif) => {
    if (!authUser || !isRemoteConversation) {
      Alert.alert('اختر مستخدمًا من Blinkr', 'افتح المحادثة من صفحة اكتشاف الأشخاص لإرسال GIF.');
      return;
    }
    if (sendAttachmentMutation.isPending) return;
    setFailedGif(null);
    setAttachmentError(null);
    try {
      await sendAttachmentMutation.mutateAsync({ otherUserId: numericOtherUserId, externalUrl: gif.images.original.url, mediaType: 'gif', mimeType: 'image/gif', size: 0 });
      setGifPickerOpen(false);
    } catch {
      setAttachmentError('تعذر إرسال GIF. اضغط لإعادة المحاولة.');
      setFailedGif(gif);
    }
  };

  const handlePickLocalGif = async () => {
    if (!authUser) { Alert.alert('يلزم تسجيل الدخول', 'سجّل الدخول لإرسال صور GIF.'); return; }
    if (!isRemoteConversation) { Alert.alert('اختر مستخدمًا من Blinkr', 'افتح المحادثة من صفحة اكتشاف الأشخاص لإرسال GIF.'); return; }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? (asset.fileName?.toLowerCase().endsWith('.gif') ? 'image/gif' : '');
      if (mimeType !== 'image/gif') { Alert.alert('اختر صورة GIF', 'اختر ملف GIF متحركًا من مكتبة الصور.'); return; }
      if (asset.fileSize && asset.fileSize > 10_000_000) { Alert.alert('ملف GIF كبير جدًا', 'اختر ملفًا يقل حجمه عن 10 ميغابايت.'); return; }
      const base64 = await readUriAsBase64(asset.uri);
      await sendAttachmentMutation.mutateAsync({ otherUserId: numericOtherUserId, base64, mediaType: 'gif', mimeType: 'image/gif', size: asset.fileSize ?? base64.length });
    } catch { Alert.alert('تعذر إرسال GIF', 'حاول مرة أخرى.'); }
  };

  const handleRecordToggle = async () => {
    if (!authUser) { Alert.alert('يلزم تسجيل الدخول', 'سجّل الدخول لإرسال الرسائل الصوتية.'); return; }
    if (!isRemoteConversation) { Alert.alert('اختر مستخدمًا من Blinkr', 'افتح المحادثة من صفحة اكتشاف الأشخاص لإرسال الرسائل الصوتية.'); return; }
    try {
      if (recorderState.isRecording) {
        await audioRecorder.stop();
        const uri = audioRecorder.uri;
        if (!uri) return;
        const base64 = await readUriAsBase64(uri);
        const mimeType = Platform.OS === 'web' ? 'audio/webm' : 'audio/m4a';
        const draft: AudioDraft = { base64, mimeType, size: base64.length };
        setAttachmentError(null);
        try {
          await sendAttachmentMutation.mutateAsync({ otherUserId: numericOtherUserId, ...draft, mediaType: 'audio' });
          setFailedAudio(null);
        } catch {
          setFailedAudio(draft);
          setAttachmentError('تعذر إرسال الرسالة الصوتية. اضغط لإعادة المحاولة.');
        }
        return;
      }
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) { Alert.alert('إذن الميكروفون مطلوب', 'اسمح باستخدام الميكروفون لتسجيل رسالة صوتية.'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch { Alert.alert('تعذر تسجيل الرسالة الصوتية', 'تحقق من إذن الميكروفون ثم حاول مرة أخرى.'); }
  };

  const handlePlayAudio = (url: string) => {
    try {
      const resolvedUrl = resolveMediaUrl(url);
      if (!resolvedUrl) throw new Error('رابط الملف غير متاح');
      audioPlayerRef.current?.remove?.();
      const player = createAudioPlayer(resolvedUrl);
      audioPlayerRef.current = player;
      player.play();
    } catch { Alert.alert('تعذر تشغيل الصوت', 'حاول مرة أخرى.'); }
  };

  const handleSendImage = async () => {
    if (!pendingImage || !authUser || sendImageMutation.isPending) return;
    try {
      setAttachmentError(null);
      const base64 = await FileSystem.readAsStringAsync(pendingImage.uri, { encoding: FileSystem.EncodingType.Base64 });
      await sendImageMutation.mutateAsync({ otherUserId: numericOtherUserId, base64, mimeType: pendingImage.mimeType === 'image/png' ? 'image/png' : 'image/jpeg', size: pendingImage.fileSize ?? base64.length });
      setPendingImage(null);
      setAttachmentError(null);
    } catch { setAttachmentError('تعذر إرسال الصورة. اضغط لإعادة المحاولة.'); }
  };

  const handleRetryAudio = async () => {
    if (!failedAudio || !isRemoteConversation || sendAttachmentMutation.isPending) return;
    try {
      setAttachmentError(null);
      await sendAttachmentMutation.mutateAsync({ otherUserId: numericOtherUserId, ...failedAudio, mediaType: 'audio' });
      setFailedAudio(null);
    } catch {
      setAttachmentError('تعذر إرسال الرسالة الصوتية. اضغط لإعادة المحاولة.');
    }
  };

  const handleDelete = () => {
    Alert.alert('حذف المحادثة', `هل تريد حذف محادثتك مع ${user.displayName}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: () => {
          deleteConversationMutation.mutate({ otherUserId: numericOtherUserId });
        },
      },
    ]);
  };

  const remoteMessages = (messagesQuery.data ?? []).map((item: any) => ({ ...item, id: String(item.id), sender: item.senderId === Number(authUser?.id) ? 'me' : 'them', createdAt: new Date(item.createdAt), text: item.text ?? '' }));
  const data = messageSearch.trim()
    ? remoteMessages.filter((item: any) => item.text.toLowerCase().includes(messageSearch.trim().toLowerCase()))
    : remoteMessages;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable style={styles.headerCenter} onPress={() => navigation.navigate('UserProfile', { userId })}>
          <UserAvatar name={user.displayName} color={user.avatarColor} size={34} imageUrl={remoteProfileQuery.data?.avatarUrl ?? user.avatarUrl ?? undefined} />
          <View>
            <Text style={styles.headerName}>{user.displayName}</Text>
            <Text style={styles.headerStatus}>{isTyping ? 'يكتب الآن…' : user.followsYou ? 'يتابعك' : `@${user.username}`}</Text>
          </View>
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable onPress={() => setMessageSearchOpen((open) => !open)} hitSlop={8} accessibilityLabel="البحث في الرسائل">
            <Ionicons name="search-outline" size={20} color={colors.textDim} />
          </Pressable>
          <Pressable onPress={() => Alert.alert('خيارات المحادثة', undefined, [{ text: 'حذف المحادثة', style: 'destructive', onPress: handleDelete }, { text: 'إلغاء', style: 'cancel' }])} hitSlop={8} accessibilityLabel="خيارات المحادثة">
            <Ionicons name="ellipsis-vertical" size={20} color={colors.textDim} />
          </Pressable>
        </View>
      </View>
      {messageSearchOpen ? <View style={styles.messageSearchBar}><Ionicons name="search-outline" size={17} color={colors.textFaint} /><TextInput autoFocus value={messageSearch} onChangeText={setMessageSearch} placeholder="ابحث في هذه المحادثة" placeholderTextColor={colors.textFaint} style={styles.messageSearchInput} returnKeyType="search" /><Pressable onPress={() => { setMessageSearch(''); setMessageSearchOpen(false); }} hitSlop={8}><Ionicons name="close" size={18} color={colors.textDim} /></Pressable></View> : null}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        {messagesQuery.isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}><ActivityIndicator color={colors.accent} /><Text style={{ color: colors.textDim, fontSize: fontSizes.sm }}>جارٍ تحميل الرسائل…</Text></View>
        ) : messagesQuery.isError && !messagesQuery.data ? (
          <ApiErrorState message="تعذر تحميل الرسائل." onRetry={() => void messagesQuery.refetch()} />
        ) : data.length === 0 ? (
          <View style={{ flex: 1 }}>
            <EmptyState icon={messageSearch.trim() ? 'search-outline' : 'chatbubble-ellipses-outline'} title={messageSearch.trim() ? 'لا توجد رسائل مطابقة' : `ابدأ المحادثة مع ${user.displayName}`} message={messageSearch.trim() ? 'جرّب كلمات بحث مختلفة.' : user.bio || 'أرسل أول رسالة لبدء الحديث.'} />
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
                    {!!(item as any).sharedMediaId && <Pressable style={styles.mediaCard} onPress={() => openCatalogItem(navigation, { mediaType: normalizeReviewMediaType((item as any).sharedMediaType), mediaId: Number((item as any).sharedMediaId), title: (item as any).sharedTitle, posterPath: (item as any).sharedPosterPath })}><Image source={{ uri: catalogPosterUrl(normalizeReviewMediaType((item as any).sharedMediaType), (item as any).sharedPosterPath, 'w342') ?? undefined }} style={styles.cardPoster} resizeMode="cover" /><View style={styles.cardCopy}><Text style={styles.cardLabel}>{(item as any).sharedMediaType === 'book' ? 'كتاب' : 'عنوان من TMDB'}</Text><Text style={styles.cardTitle} numberOfLines={2}>{(item as any).sharedTitle}</Text><Text style={styles.cardRating}>★ {(((item as any).sharedRating ?? 0) / 10).toFixed(1)}</Text></View></Pressable>}
                    {!!(item as any).mediaUrl && (item as any).mediaType === 'audio' ? <Pressable style={styles.audioMessage} onPress={() => handlePlayAudio((item as any).mediaUrl)}><Ionicons name="play" size={18} color={mine ? '#04120C' : colors.accent} /><View style={styles.audioWave}><View style={styles.audioLine} /><View style={[styles.audioLine, styles.audioLineLong]} /><View style={styles.audioLine} /></View><Text style={[styles.audioLabel, mine && styles.bubbleTextMine]}>رسالة صوتية</Text></Pressable> : null}
                    {!!(item as any).mediaUrl && (item as any).mediaType === 'gif' && resolveMediaUrl((item as any).mediaUrl) ? <Image source={{ uri: resolveMediaUrl((item as any).mediaUrl) }} style={styles.messageGif} resizeMode="cover" /> : null}
                    {!!(item as any).mediaUrl && (item as any).mediaType !== 'audio' && (item as any).mediaType !== 'gif' && resolveMediaUrl((item as any).mediaUrl) ? <Image source={{ uri: resolveMediaUrl((item as any).mediaUrl) }} style={styles.messageImage} resizeMode="cover" /> : null}
                    {!!item.text && <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.text}</Text>}
                  </View>
                  <Text style={[styles.bubbleTime, mine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                    {formatMessageTime(item.createdAt)}{mine ? `  ${((item as any).readAt ? '✓✓' : '✓')}` : ''}
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

        {attachmentError ? <View style={styles.attachmentError}><Ionicons name="warning-outline" size={16} color="#FF8A4C" /><Text style={styles.attachmentErrorText}>{attachmentError}</Text><Pressable onPress={() => failedAudio ? handleRetryAudio() : pendingImage ? handleSendImage() : failedGif ? handleSelectGiphy(failedGif) : undefined} disabled={sendImageMutation.isPending || sendAttachmentMutation.isPending}><Text style={styles.retryAction}>إعادة المحاولة</Text></Pressable></View> : null}
        {pendingImage ? <View style={styles.previewBar}><Image source={{ uri: pendingImage.uri }} style={styles.previewImage} /><View style={styles.previewCopy}><Text style={styles.previewTitle}>جاهزة للإرسال</Text><Text style={styles.previewMeta}>{pendingImage.width} × {pendingImage.height}</Text></View><Pressable onPress={() => { setPendingImage(null); setAttachmentError(null); }} style={styles.previewCancel}><Ionicons name="close" size={19} color={colors.textDim} /></Pressable><Pressable onPress={handleSendImage} style={styles.previewSend} disabled={sendImageMutation.isPending}><Ionicons name="send" size={16} color="#04120C" /></Pressable></View> : null}
        <View style={styles.inputBar}>
          <Pressable style={({ pressed }) => [styles.attachBtn, pressed && styles.iconBtnPressed]} onPress={() => setAttachmentOpen(true)} accessibilityLabel="فتح قائمة المرفقات">
            <Ionicons name="add" size={24} color={colors.textDim} />
          </Pressable>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={`راسل ${user.displayName}`}
            placeholderTextColor={colors.textFaint}
            selectionColor={colors.accent}
            cursorColor={colors.accent}
            multiline
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <Pressable style={({ pressed }) => [styles.emojiBtn, pressed && styles.iconBtnPressed]} onPress={() => setText((current) => `${current}${current ? ' ' : ''}😊`)} accessibilityLabel="إضافة رمز تعبيري">
            <Ionicons name="happy-outline" size={20} color={colors.textDim} />
          </Pressable>
          {text.trim() ? <Pressable style={({ pressed }) => [styles.sendBtn, pressed && styles.sendBtnPressed]} onPress={handleSend} accessibilityLabel="إرسال الرسالة">
            <Ionicons name="arrow-up" size={19} color="#04120C" />
          </Pressable> : <Pressable style={({ pressed }) => [styles.voiceBtn, pressed && styles.sendBtnPressed]} onPress={handleRecordToggle} accessibilityLabel={recorderState.isRecording ? 'إيقاف التسجيل' : 'رسالة صوتية'}>
            <Ionicons name="mic" size={19} color={colors.bg} />
          </Pressable>}
        </View>
      </KeyboardAvoidingView>
      <Modal visible={cardPickerOpen} animationType="slide" transparent onRequestClose={() => setCardPickerOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.cardPicker}><View style={styles.modalHeader}><Text style={styles.modalTitle}>مشاركة فيلم أو مسلسل</Text><Pressable onPress={() => setCardPickerOpen(false)}><Ionicons name="close" size={22} color={colors.text} /></Pressable></View><TextInput autoFocus selectionColor={colors.accent} cursorColor={colors.accent} value={cardSearch} onChangeText={setCardSearch} placeholder="ابحث في TMDB…" placeholderTextColor={colors.textFaint} style={styles.cardSearchInput} />{failedCard ? <View style={styles.retryRow}><Text style={styles.retryText}>تعذرت مشاركة العنوان.</Text><Pressable onPress={() => shareMediaMutation.mutate(failedCard)} disabled={shareMediaMutation.isPending}><Text style={styles.retryAction}>إعادة المحاولة</Text></Pressable></View> : null}{cardSearchQuery.isLoading ? <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} /> : <FlatList data={(((cardSearchQuery.data as any)?.results ?? [])).filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')} keyExtractor={(item: any) => `${item.media_type}-${item.id}`} contentContainerStyle={{ paddingBottom: spacing.lg }} ListEmptyComponent={cardSearch.length >= 2 ? <EmptyState icon="search-outline" title="لم نعثر على عناوين" message="جرّب عنوانًا آخر." /> : <EmptyState icon="film-outline" title="ابحث عن عنوان" message="اعثر على فيلم أو مسلسل لمشاركته." />} renderItem={({ item }: { item: any }) => <Pressable style={styles.cardResult} disabled={shareMediaMutation.isPending} onPress={() => shareMediaMutation.mutate({ otherUserId: numericOtherUserId, mediaType: item.media_type, mediaId: item.id, title: item.title, posterPath: item.posterPath, rating: item.voteAverage ?? 0, overview: item.overview ?? null })}><Image source={{ uri: item.posterPath ? `https://image.tmdb.org/t/p/w200${item.posterPath}` : undefined }} style={styles.resultPoster} /><View style={styles.resultCopy}><Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text><Text style={styles.resultMeta}>{item.media_type === 'tv' ? 'مسلسل' : 'فيلم'} · ★ {(item.voteAverage ?? 0).toFixed(1)}</Text></View>{shareMediaMutation.isPending ? <ActivityIndicator color={colors.accent} /> : <Ionicons name="paper-plane-outline" size={18} color={colors.accent} />}</Pressable>} />}</View></View>
      </Modal>
      <Modal visible={gifPickerOpen} transparent animationType="slide" onRequestClose={() => setGifPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.gifPicker}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>ابحث عن GIF</Text><Pressable onPress={() => setGifPickerOpen(false)}><Ionicons name="close" size={22} color={colors.text} /></Pressable></View>
            <View style={styles.gifSearchRow}><TextInput autoFocus selectionColor={colors.accent} cursorColor={colors.accent} value={gifSearch} onChangeText={setGifSearch} onSubmitEditing={handleSearchGifs} placeholder="ابحث في GIPHY…" placeholderTextColor={colors.textFaint} style={styles.gifSearchInput} returnKeyType="search" /><Pressable style={styles.gifSearchButton} onPress={handleSearchGifs}><Ionicons name="search" size={18} color="#04120C" /></Pressable></View>
            {gifError ? <View style={styles.retryRow}><Text style={styles.retryText}>تعذر تحميل صور GIF.</Text><Pressable onPress={() => loadGifs(gifSearch, 0, true)}><Text style={styles.retryAction}>إعادة المحاولة</Text></Pressable></View> : null}
            {failedGif ? <View style={styles.retryRow}><Text style={styles.retryText}>تعذر إرسال صورة GIF.</Text><Pressable onPress={() => handleSelectGiphy(failedGif)} disabled={sendAttachmentMutation.isPending}><Text style={styles.retryAction}>{sendAttachmentMutation.isPending ? 'جارٍ الإرسال…' : 'إعادة المحاولة'}</Text></Pressable></View> : null}
            {gifResults.length === 0 && gifLoading ? <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} /> : <FlatList data={gifResults} numColumns={2} keyExtractor={(item) => item.id} columnWrapperStyle={styles.gifColumns} contentContainerStyle={styles.gifGrid} onEndReached={() => { if (!gifLoading && gifResults.length > 0) void loadGifs(gifSearch, gifOffset, false); }} onEndReachedThreshold={0.5} ListEmptyComponent={!gifLoading ? <EmptyState icon="images-outline" title="لم نعثر على صور GIF" message="جرّب عبارة بحث أخرى." /> : null} renderItem={({ item }) => <Pressable style={styles.gifResult} onPress={() => handleSelectGiphy(item)} disabled={sendAttachmentMutation.isPending}><Image source={{ uri: item.images.fixed_width.url }} style={styles.gifThumb} resizeMode="cover" />{sendAttachmentMutation.isPending ? <View style={styles.gifSending}><ActivityIndicator color={colors.accent} /></View> : null}</Pressable>} ListFooterComponent={gifLoading && gifResults.length > 0 ? <ActivityIndicator color={colors.accent} style={{ paddingVertical: spacing.md }} /> : null} />}
            <Text style={styles.giphyAttribution}>بدعم من GIPHY</Text>
          </View>
        </View>
      </Modal>
      <Modal visible={attachmentOpen} transparent animationType="slide" onRequestClose={() => setAttachmentOpen(false)}>
        <View style={styles.attachmentBackdrop}>
          <Pressable style={styles.attachmentDismiss} onPress={() => setAttachmentOpen(false)} accessibilityLabel="إغلاق قائمة المرفقات" />
          <View style={styles.attachmentSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>شارك شيئًا</Text>
            <View style={styles.attachmentGrid}>
              <Pressable style={styles.attachmentItem} onPress={() => { setAttachmentOpen(false); setCardPickerOpen(true); }}><View style={[styles.attachmentIcon, { backgroundColor: 'rgba(53, 211, 153, 0.16)' }]}><Ionicons name="film" size={22} color={colors.accent} /></View><Text style={styles.attachmentLabel}>مشاركة فيلم</Text></Pressable>
              <Pressable style={styles.attachmentItem} onPress={() => { setAttachmentOpen(false); Alert.alert('إرسال صورة', 'اختر مصدر الصورة', [{ text: 'الكاميرا', onPress: () => handlePickImage(true) }, { text: 'مكتبة الصور', onPress: () => handlePickImage(false) }, { text: 'إلغاء', style: 'cancel' }]); }}><View style={[styles.attachmentIcon, { backgroundColor: 'rgba(91, 178, 255, 0.16)' }]}><Ionicons name="image" size={22} color="#62B2FF" /></View><Text style={styles.attachmentLabel}>إرسال صورة</Text></Pressable>
              <Pressable style={styles.attachmentItem} onPress={openGifPicker}><View style={[styles.attachmentIcon, { backgroundColor: 'rgba(146, 91, 255, 0.18)' }]}><Text style={styles.gifLabel}>GIF</Text></View><Text style={styles.attachmentLabel}>العثور على GIF</Text></Pressable>
              <Pressable style={styles.attachmentItem} onPress={() => { setAttachmentOpen(false); handleRecordToggle(); }}><View style={[styles.attachmentIcon, { backgroundColor: 'rgba(255, 126, 58, 0.16)' }]}><Ionicons name="mic" size={22} color="#FF8A4C" /></View><Text style={styles.attachmentLabel}>{recorderState.isRecording ? 'إيقاف التسجيل' : 'رسالة صوتية'}</Text></Pressable>
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
  messageSearchBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.sm, paddingHorizontal: spacing.md, height: 42, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  messageSearchInput: { flex: 1, color: colors.text, fontSize: fontSizes.sm, paddingVertical: 0 },
  messagesContent: { padding: spacing.lg, gap: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { color: colors.textDim, fontSize: fontSizes.sm },
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
  gifPicker: { maxHeight: '88%', backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: spacing.lg },
  gifSearchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  gifSearchInput: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, paddingHorizontal: spacing.md, height: 44 },
  gifSearchButton: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  gifGrid: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  gifColumns: { gap: spacing.sm, marginBottom: spacing.sm },
  gifResult: { flex: 1, height: 132, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceHigh },
  gifThumb: { width: '100%', height: '100%' },
  gifSending: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  giphyAttribution: { color: colors.textFaint, fontSize: 10, textAlign: 'center', paddingTop: spacing.xs },
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
  attachmentError: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginHorizontal: spacing.lg, marginBottom: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm, backgroundColor: 'rgba(255,138,76,0.12)' },
  attachmentErrorText: { flex: 1, color: colors.textDim, fontSize: 11 },
  mediaCard: { flexDirection: 'row', width: 245, minHeight: 118, overflow: 'hidden', borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  cardPoster: { width: 76, height: 118, backgroundColor: colors.surfaceHigh },
  cardCopy: { flex: 1, padding: spacing.sm, justifyContent: 'center' },
  cardLabel: { color: colors.textFaint, fontSize: 10, fontWeight: '700', marginBottom: 4 },
  cardTitle: { color: colors.text, fontSize: fontSizes.sm, fontWeight: '800', lineHeight: 18 },
  cardRating: { color: colors.accent, fontSize: 12, fontWeight: '800', marginTop: 7 },
  messageImage: { width: 190, height: 190, borderRadius: radius.md, marginBottom: spacing.xs },
  messageGif: { width: 210, height: 160, borderRadius: radius.md, marginBottom: spacing.xs },
  audioMessage: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 190 },
  audioWave: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, height: 24 },
  audioLine: { width: 3, height: 10, borderRadius: 2, backgroundColor: colors.accent },
  audioLineLong: { height: 19 },
  audioLabel: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
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

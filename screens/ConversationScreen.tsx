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

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type RouteT = RouteProp<ContentStackParamList, 'Conversation'>;

export default function ConversationScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const { userId } = route.params;
  const social = useSocial();
  const user = social.getUser(userId);
  const convo = social.getConversation(userId);
  const isTyping = !!social.typingUserIds[userId];
  const [text, setText] = useState('');
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

  const handleSend = () => {
    if (!text.trim()) return;
    social.sendMessage(userId, text);
    setText('');
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

  const data = [...convo.messages].reverse();

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
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.text}</Text>
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

        <View style={styles.inputBar}>
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

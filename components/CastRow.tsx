import React from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { profileUrl } from '../lib/tmdb';
import { CastMember } from '../types/tmdb';
import { colors, fontSizes, spacing } from '../lib/theme';

interface Props {
  cast: CastMember[];
  onPress?: (member: CastMember) => void;
}

export default function CastRow({ cast, onPress }: Props) {
  if (!cast.length) return null;
  return (
    <FlatList
      data={cast}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => {
        const uri = profileUrl(item.profile_path);
        return (
          <Pressable style={styles.card} onPress={() => onPress?.(item)}>
            <View style={styles.avatar}>
              {uri ? (
                <Image source={{ uri }} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <Ionicons name="person" size={26} color={colors.textFaint} />
              )}
            </View>
            <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
            <Text numberOfLines={1} style={styles.character}>{item.character}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: { width: 84, marginRight: spacing.sm },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  avatarImg: { width: '100%', height: '100%' },
  name: { color: colors.text, fontSize: fontSizes.xs, fontWeight: '700', textAlign: 'center' },
  character: { color: colors.textFaint, fontSize: 10, textAlign: 'center', marginTop: 1 },
});

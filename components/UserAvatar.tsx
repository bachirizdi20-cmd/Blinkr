import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '../lib/theme';
import { resolveMediaUrl } from '../lib/media-url';

interface Props {
  name: string;
  color: string;
  size?: number;
  ring?: boolean;
  imageUrl?: string;
}

export default function UserAvatar({ name, color, size = 48, ring = false, imageUrl }: Props) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: ring ? 2 : 0,
          borderColor: colors.accent,
          overflow: 'hidden',
        },
      ]}
    >
      {resolveMediaUrl(imageUrl) ? (
        <Image source={{ uri: resolveMediaUrl(imageUrl) }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      ) : (
        <Text style={[styles.text, { fontSize: size * 0.36 }]}>{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#04120C', fontWeight: '800' },
});

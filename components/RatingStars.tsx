import React from 'react';
import { View, StyleSheet, Pressable, GestureResponderEvent } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../lib/theme';

interface Props {
  rating: number; // 0-5 step 0.5
  size?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  color?: string;
}

export default function RatingStars({ rating, size = 20, interactive = false, onChange, color }: Props) {
  const starColor = color ?? colors.gold;

  const handlePress = (index: number, evt: GestureResponderEvent) => {
    if (!interactive || !onChange) return;
    const x = evt.nativeEvent.locationX;
    const half = x < size / 2;
    const value = index + (half ? 0.5 : 1);
    onChange(value);
  };

  return (
    <View style={styles.row}>
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = rating >= i + 1;
        const halfFilled = !filled && rating >= i + 0.5;
        const iconName = filled ? 'star' : halfFilled ? 'star-half' : 'star-outline';
        return (
          <Pressable
            key={i}
            disabled={!interactive}
            onPress={(e) => handlePress(i, e)}
            hitSlop={4}
            style={{ paddingHorizontal: 1 }}
          >
            <Ionicons name={iconName as any} size={size} color={starColor} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});

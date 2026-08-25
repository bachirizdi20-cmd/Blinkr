import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, fontSizes, radius, spacing } from "../lib/theme";

interface Props {
  message?: string;
  onRetry: () => void;
}

export default function ApiErrorState({ message = "We couldn't load this right now.", onRetry }: Props) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={38} color={colors.textFaint} />
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry loading"
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Ionicons name="refresh" size={16} color={colors.bg} />
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, gap: spacing.sm },
  title: { color: colors.text, fontSize: fontSizes.md, fontWeight: "700", marginTop: spacing.xs },
  message: { color: colors.textDim, fontSize: fontSizes.sm, textAlign: "center", lineHeight: 20 },
  button: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.xs },
  buttonPressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  buttonText: { color: colors.bg, fontSize: fontSizes.sm, fontWeight: "800" },
});

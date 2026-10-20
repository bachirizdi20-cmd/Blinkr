import React from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import Ionicons from "@expo/vector-icons/Ionicons";

import RootTabNavigator from "@/navigation/RootTabNavigator";
import { LibraryProvider } from "@/context/LibraryContext";
import { MetadataProvider } from "@/context/MetadataContext";
import { SocialProvider } from "@/context/SocialContext";
import { trpc, createTRPCClient } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { AuthPanel } from "@/components/AuthPanel";
import { colors, fontSizes, spacing } from "@/lib/theme";

function FirstLaunchGate() {
  const { user, loading, error, refresh } = useAuth();

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.accent} /></View>;
  }

  if (!user) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
      >
        <ScrollView
          style={{ flex: 1, width: "100%" }}
          contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.lg }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        >
          <View style={{ width: "100%", maxWidth: 460, backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg }}>
            <View style={{ alignItems: "center", marginBottom: spacing.md }}>
              <View style={{ width: 56, height: 56, borderRadius: 17, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm }}>
                <Text style={{ color: colors.bg, fontSize: 32, fontWeight: "900", letterSpacing: -2 }}>B</Text>
              </View>
              <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -1 }}>Blinkr</Text>
              <Text style={{ color: colors.textDim, fontSize: fontSizes.sm, textAlign: "center", lineHeight: 21, marginTop: spacing.xs, maxWidth: 320, writingDirection: "rtl" }}>اكتشف ما تشاهده. شارك ما تحب.</Text>
            </View>
            {error ? <Text style={{ color: colors.danger, fontSize: fontSizes.sm, textAlign: "center", marginBottom: spacing.md, writingDirection: "rtl" }}>{error.message}</Text> : null}
            <AuthPanel onAuthenticated={refresh} />
          </View>
          <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: spacing.md, textAlign: "center", writingDirection: "rtl" }}>تسجيل آمن • بياناتك تبقى خاصة</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return <RootTabNavigator />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ ...Ionicons.font });
  const [queryClient] = React.useState(() => new QueryClient());
  const [trpcClient] = React.useState(() => createTRPCClient());

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <LibraryProvider>
          <MetadataProvider>
            <SocialProvider>
              <StatusBar style="light" />
              <FirstLaunchGate />
            </SocialProvider>
            </MetadataProvider>
          </LibraryProvider>
          </trpc.Provider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

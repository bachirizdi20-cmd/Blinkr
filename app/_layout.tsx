import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
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
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <Text style={{ color: colors.text, fontSize: 32, fontWeight: "900", letterSpacing: -1 }}>Welcome to Blinkr</Text>
        <Text style={{ color: colors.textDim, fontSize: fontSizes.md, textAlign: "center", lineHeight: 22, marginTop: spacing.sm, maxWidth: 360 }}>Sign in to save your watchlist, reviews, and social activity across devices.</Text>
        {error ? <Text style={{ color: colors.danger, fontSize: fontSizes.sm, textAlign: "center", marginTop: spacing.md }}>{error.message}</Text> : null}
        <AuthPanel onAuthenticated={refresh} />
        <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: spacing.md }}>Secure authentication • Your data stays private</Text>
      </View>
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

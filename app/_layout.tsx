import "react-native-gesture-handler";
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import RootTabNavigator from "@/navigation/RootTabNavigator";
import { LibraryProvider } from "@/context/LibraryContext";
import { MetadataProvider } from "@/context/MetadataContext";
import { SocialProvider } from "@/context/SocialContext";
import { trpc, createTRPCClient } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { startOAuthLogin } from "@/constants/oauth";
import { colors, fontSizes, radius, spacing } from "@/lib/theme";

const FIRST_RUN_KEY = '@reelog/first-run-complete';

function FirstLaunchGate() {
  const { user, loading, error } = useAuth();
  const [checked, setChecked] = React.useState(false);
  const [completed, setCompleted] = React.useState(false);
  const [loginLoading, setLoginLoading] = React.useState(false);
  const [loginError, setLoginError] = React.useState<string | null>(null);

  React.useEffect(() => {
    AsyncStorage.getItem(FIRST_RUN_KEY).then((value) => {
      setCompleted(value === 'true');
      setChecked(true);
    }).catch(() => setChecked(true));
  }, []);

  React.useEffect(() => {
    if (user && !completed) {
      setCompleted(true);
      AsyncStorage.setItem(FIRST_RUN_KEY, 'true').catch(() => undefined);
    }
  }, [user, completed]);

  if (!checked || loading) {
    return <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.accent} /></View>;
  }

  if (!completed && !user) {
    const handleLogin = async () => {
      setLoginLoading(true);
      setLoginError(null);
      try { await startOAuthLogin(); } catch (error) { setLoginError(error instanceof Error ? error.message : 'Unable to start authentication'); } finally { setLoginLoading(false); }
    };
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
        <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}><Ionicons name="film-outline" size={40} color={colors.bg} /></View>
        <Text style={{ color: colors.text, fontSize: 32, fontWeight: '900', letterSpacing: -1 }}>Welcome to Reelog</Text>
        <Text style={{ color: colors.textDim, fontSize: fontSizes.md, textAlign: 'center', lineHeight: 22, marginTop: spacing.sm, maxWidth: 360 }}>Sign in to save your watchlist, reviews, and social activity across devices.</Text>
        {error || loginError ? <Text style={{ color: colors.danger, fontSize: fontSizes.sm, textAlign: 'center', marginTop: spacing.md }}>{loginError ?? 'We could not restore your session. Please sign in again.'}</Text> : null}
        <Pressable onPress={handleLogin} disabled={loginLoading} style={({ pressed }) => ({ marginTop: spacing.xl, width: '100%', maxWidth: 360, backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center', opacity: pressed || loginLoading ? 0.7 : 1 })}>
          {loginLoading ? <ActivityIndicator color={colors.bg} /> : <Text style={{ color: colors.bg, fontSize: fontSizes.md, fontWeight: '900' }}>Sign in / Create account</Text>}
        </Pressable>
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

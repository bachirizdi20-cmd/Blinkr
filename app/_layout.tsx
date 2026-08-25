import "react-native-gesture-handler";
import React from "react";
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
              <RootTabNavigator />
            </SocialProvider>
            </MetadataProvider>
          </LibraryProvider>
          </trpc.Provider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

import "react-native-gesture-handler";
import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import Ionicons from "@expo/vector-icons/Ionicons";

import RootTabNavigator from "@/navigation/RootTabNavigator";
import { LibraryProvider } from "@/context/LibraryContext";
import { MetadataProvider } from "@/context/MetadataContext";
import { SocialProvider } from "@/context/SocialContext";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ ...Ionicons.font });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LibraryProvider>
          <MetadataProvider>
            <SocialProvider>
              <StatusBar style="light" />
              <RootTabNavigator />
            </SocialProvider>
          </MetadataProvider>
        </LibraryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

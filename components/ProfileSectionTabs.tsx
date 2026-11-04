import React from 'react';
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, UIManager } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing } from '../lib/theme';

export type ProfileSectionTab = 'reviews' | 'saved' | 'completed';

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);

export function animateProfileTabChange() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

const TABS: Array<{ key: ProfileSectionTab; icon: React.ComponentProps<typeof Ionicons>['name']; activeIcon: React.ComponentProps<typeof Ionicons>['name']; label: string }> = [
  { key: 'reviews', icon: 'chatbox-ellipses-outline', activeIcon: 'chatbox-ellipses', label: 'المراجعات' },
  { key: 'saved', icon: 'bookmark-outline', activeIcon: 'bookmark', label: 'المحفوظات' },
  { key: 'completed', icon: 'checkmark-circle-outline', activeIcon: 'checkmark-circle', label: 'المكتمل' },
];

export function ProfileSectionTabs({ activeTab, onChange }: { activeTab: ProfileSectionTab; onChange: (tab: ProfileSectionTab) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabs}
      accessibilityRole="tablist"
    >
      {TABS.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [styles.tab, active && styles.activeTab, pressed && styles.pressed]}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
          >
            <Ionicons name={active ? tab.activeIcon : tab.icon} size={22} color={active ? colors.accent : colors.textDim} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabs: { flexGrow: 1, flexDirection: 'row-reverse', justifyContent: 'space-around', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, marginTop: spacing.lg, marginBottom: spacing.md },
  tab: { flex: 1, minWidth: 58, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', paddingBottom: 1 },
  activeTab: { borderBottomColor: colors.accent },
  pressed: { opacity: 0.7 },
});

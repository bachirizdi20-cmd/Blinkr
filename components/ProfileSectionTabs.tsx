import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing } from '../lib/theme';

export type ProfileSectionTab = 'reviews' | 'saved' | 'completed' | 'lists';

const TABS: Array<{ key: ProfileSectionTab; icon: React.ComponentProps<typeof Ionicons>['name']; label: string }> = [
  { key: 'reviews', icon: 'chatbox-ellipses-outline', label: 'المراجعات المنشورة' },
  { key: 'saved', icon: 'bookmark-outline', label: 'المحفوظات' },
  { key: 'completed', icon: 'checkmark-circle-outline', label: 'تمت المشاهدة أو القراءة' },
  { key: 'lists', icon: 'list-outline', label: 'القوائم' },
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
            <Ionicons name={tab.icon} size={23} color={active ? colors.accent : colors.textDim} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabs: { flexGrow: 1, flexDirection: 'row', justifyContent: 'space-around', borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: spacing.sm, marginBottom: spacing.lg },
  tab: { flex: 1, minWidth: 58, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: colors.accent },
  pressed: { opacity: 0.7 },
});

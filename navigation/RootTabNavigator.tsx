import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ContentStackNavigator from './ContentStack';
import HomeScreen from '../screens/HomeScreen';
import ChatsScreen from '../screens/ChatsScreen';
import CreateScreen from '../screens/CreateScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/use-auth';
import { colors } from '../lib/theme';

const Tab = createBottomTabNavigator();

function HomeStackScreen() {
  return <ContentStackNavigator initialRouteName="HomeMain" HomeComponent={HomeScreen} />;
}

function ChatsStackScreen() {
  return <ContentStackNavigator initialRouteName="ChatsMain" HomeComponent={ChatsScreen} />;
}

function CreateStackScreen() {
  return <ContentStackNavigator initialRouteName="CreateMain" HomeComponent={CreateScreen} />;
}

function NotificationsStackScreen() {
  return <ContentStackNavigator initialRouteName="Notifications" HomeComponent={NotificationsScreen} />;
}

function ProfileStackScreen() {
  return <ContentStackNavigator initialRouteName="ProfileMain" HomeComponent={ProfileScreen} />;
}

export default function RootTabNavigator() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'web' ? 8 : 6);
  const tabBarHeight = 58 + bottomInset;
  const { user } = useAuth();
  const conversationsQuery = trpc.social.conversations.useQuery(undefined, { enabled: Boolean(user), retry: 1, refetchInterval: 5000 });
  const totalUnread = conversationsQuery.data?.reduce((total, conversation) => total + conversation.unreadCount, 0) ?? 0;
  const notificationsQuery = trpc.social.notifications.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const unreadNotifications = notificationsQuery.data?.filter((item) => !item.readAt).length ?? 0;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabBarHeight,
          paddingBottom: bottomInset,
          paddingTop: 4,
          elevation: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: { fontSize: 10, lineHeight: 13, fontWeight: '700', marginTop: 0 },
        tabBarIconStyle: { marginTop: 0 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="Home"
        options={{ title: 'الرئيسية', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} /> }}
        component={HomeStackScreen}
      />
      <Tab.Screen
        name="Chats"
        options={{
          title: 'المحادثات',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={22} color={color} />,
          tabBarBadge: totalUnread > 0 ? totalUnread : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, color: '#fff', fontSize: 10, minWidth: 16, height: 16, lineHeight: 16 },
        }}
        component={ChatsStackScreen}
      />
      <Tab.Screen
        name="Create"
        options={{
          title: 'إنشاء',
          tabBarIcon: () => <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, marginTop: -8, borderWidth: 3, borderColor: colors.bgElevated }}><Ionicons name="add" size={22} color={colors.bg} /></View>,
        }}
        component={CreateStackScreen}
      />
      <Tab.Screen
        name="Notifications"
        options={{
          title: 'الإشعارات',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={22} color={color} />,
          tabBarBadge: unreadNotifications > 0 ? (unreadNotifications > 99 ? '99+' : unreadNotifications) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.bg, fontSize: 10, minWidth: 16, height: 16, lineHeight: 16 },
        }}
        component={NotificationsStackScreen}
      />
      <Tab.Screen
        name="Profile"
        options={{ title: 'الملف الشخصي', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} /> }}
        component={ProfileStackScreen}
      />
    </Tab.Navigator>
  );
}

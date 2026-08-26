import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import ContentStackNavigator from './ContentStack';
import HomeScreen from '../screens/HomeScreen';
import ChatsScreen from '../screens/ChatsScreen';
import CreateScreen from '../screens/CreateScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/use-auth';
import { useSocial } from '../context/SocialContext';
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
  const { totalUnread } = useSocial();
  const { user } = useAuth();
  const notificationsQuery = trpc.social.notifications.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const unreadNotifications = notificationsQuery.data?.filter((item) => !item.readAt).length ?? 0;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="Home"
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }}
        component={HomeStackScreen}
      />
      <Tab.Screen
        name="Chats"
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
          tabBarBadge: totalUnread > 0 ? totalUnread : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, color: '#fff', fontSize: 10, minWidth: 16, height: 16, lineHeight: 16 },
        }}
        component={ChatsStackScreen}
      />
      <Tab.Screen
        name="Create"
        options={{
          tabBarLabel: 'Create',
          tabBarIcon: ({ color }) => <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, marginTop: -18, borderWidth: 4, borderColor: colors.bgElevated }}><Ionicons name="add" size={28} color={colors.bg} /></View>,
        }}
        component={CreateStackScreen}
      />
      <Tab.Screen
        name="Notifications"
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications" size={size} color={color} />,
          tabBarBadge: unreadNotifications > 0 ? (unreadNotifications > 99 ? '99+' : unreadNotifications) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.bg, fontSize: 10, minWidth: 16, height: 16, lineHeight: 16 },
        }}
        component={NotificationsStackScreen}
      />
      <Tab.Screen
        name="Profile"
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }}
        component={ProfileStackScreen}
      />
    </Tab.Navigator>
  );
}

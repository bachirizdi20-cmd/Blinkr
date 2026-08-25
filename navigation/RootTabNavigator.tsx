import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import ContentStackNavigator from './ContentStack';
import HomeScreen from '../screens/HomeScreen';
import ChatsScreen from '../screens/ChatsScreen';
import WatchlistScreen from '../screens/WatchlistScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useSocial } from '../context/SocialContext';
import { colors } from '../lib/theme';

const Tab = createBottomTabNavigator();

export default function RootTabNavigator() {
  const { totalUnread } = useSocial();

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
      >
        {() => <ContentStackNavigator initialRouteName="HomeMain" HomeComponent={HomeScreen} />}
      </Tab.Screen>
      <Tab.Screen
        name="Chats"
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
          tabBarBadge: totalUnread > 0 ? totalUnread : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, color: '#fff', fontSize: 10, minWidth: 16, height: 16, lineHeight: 16 },
        }}
      >
        {() => <ContentStackNavigator initialRouteName="ChatsMain" HomeComponent={ChatsScreen} />}
      </Tab.Screen>
      <Tab.Screen
        name="Watchlist"
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="bookmark" size={size} color={color} /> }}
      >
        {() => <ContentStackNavigator initialRouteName="WatchlistMain" HomeComponent={WatchlistScreen} />}
      </Tab.Screen>
      <Tab.Screen
        name="Profile"
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }}
      >
        {() => <ContentStackNavigator initialRouteName="ProfileMain" HomeComponent={ProfileScreen} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

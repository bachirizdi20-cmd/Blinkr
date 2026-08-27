import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ContentStackParamList } from './types';
import DetailScreen from '../screens/DetailScreen';
import BookDetailScreen from '../screens/BookDetailScreen';
import SeasonScreen from '../screens/SeasonScreen';
import PersonScreen from '../screens/PersonScreen';
import CategoryListScreen from '../screens/CategoryListScreen';
import ListsScreen from '../screens/ListsScreen';
import ListDetailScreen from '../screens/ListDetailScreen';
import DiaryScreen from '../screens/DiaryScreen';
import LikesScreen from '../screens/LikesScreen';
import ReviewsScreen from '../screens/ReviewsScreen';
import AllReviewsScreen from '../screens/AllReviewsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ReviewModalScreen from '../screens/ReviewModalScreen';
import AddToListScreen from '../screens/AddToListScreen';
import CreateScreen from '../screens/CreateScreen';
import SearchScreen from '../screens/SearchScreen';
import ConversationScreen from '../screens/ConversationScreen';
import PeopleScreen from '../screens/PeopleScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import { colors } from '../lib/theme';

const Stack = createNativeStackNavigator<ContentStackParamList>();

const headerOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '800' as const },
  headerShadowVisible: false,
};

interface Props {
  initialRouteName: keyof ContentStackParamList;
  HomeComponent: React.ComponentType<any>;
}

export default function ContentStackNavigator({ initialRouteName, HomeComponent }: Props) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={headerOptions}>
      <Stack.Screen name="HomeMain" component={HomeComponent} options={{ headerShown: false }} />
      <Stack.Screen name="ChatsMain" component={HomeComponent} options={{ headerShown: false }} />
      <Stack.Screen name="WatchlistMain" component={HomeComponent} options={{ headerShown: false }} />
      <Stack.Screen name="ProfileMain" component={HomeComponent} options={{ headerShown: false }} />
      <Stack.Screen name="Detail" component={DetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BookDetail" component={BookDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Season" component={SeasonScreen} options={{ title: '' }} />
      <Stack.Screen name="Person" component={PersonScreen} options={{ title: '' }} />
      <Stack.Screen name="CategoryList" component={CategoryListScreen} options={({ route }: any) => ({ title: route.params?.title ?? '' })} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Conversation" component={ConversationScreen} options={{ headerShown: false }} />
      <Stack.Screen name="People" component={PeopleScreen} options={{ headerShown: false }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreateMain" component={CreateScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Lists" component={ListsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ListDetail" component={ListDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Diary" component={DiaryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Likes" component={LikesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Reviews" component={ReviewsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AllReviews" component={AllReviewsScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ headerShown: false, presentation: 'modal' }}
      />
      <Stack.Screen
        name="ReviewModal"
        component={ReviewModalScreen}
        options={{ headerShown: false, presentation: 'modal' }}
      />
      <Stack.Screen
        name="AddToList"
        component={AddToListScreen}
        options={{ headerShown: false, presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}

import { MediaType } from '../types/tmdb';
import { FeedDescriptor } from '../lib/tmdb';
import { PeopleFilter } from '../types/social';

export type ContentStackParamList = {
  HomeMain: undefined;
  ChatsMain: undefined;
  WatchlistMain: undefined;
  CreateMain: undefined;
  ProfileMain: undefined;
  Detail: { mediaType: MediaType; id: number };
  Season: { tvId: number; seasonNumber: number; tvName: string };
  Person: { personId: number; name: string };
  CategoryList: { title: string; feed: FeedDescriptor };
  Search: undefined;
  Lists: undefined;
  ListDetail: { listId: string };
  Diary: undefined;
  Likes: undefined;
  Reviews: undefined;
  AllReviews: { mediaType: MediaType; id: number; title: string };
  EditProfile: undefined;
  Conversation: { userId: string };
  People: { initialFilter?: PeopleFilter; shareMedia?: { mediaType: MediaType; mediaId: number; title: string; posterPath: string | null; rating: number; overview?: string | null } } | undefined;
  Notifications: undefined;
  UserProfile: { userId: string };
  ReviewModal: {
    mediaType: MediaType;
    mediaId: number;
    title: string;
    posterPath: string | null;
    genreIds?: number[];
    entryId?: string;
  };
  AddToList: {
    mediaType: MediaType;
    mediaId: number;
    title: string;
    posterPath: string | null;
    genreIds?: number[];
  };
};

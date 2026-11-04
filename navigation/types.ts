import { MediaType, ReviewMediaType } from '../types/tmdb';
import { FeedDescriptor } from '../lib/tmdb';
import { PeopleFilter } from '../types/social';
import { BookSummary } from '../types/books';

export type ContentStackParamList = {
  HomeMain: undefined;
  ChatsMain: undefined;
  WatchlistMain: undefined;
  CreateMain: undefined;
  ProfileMain: undefined;
  Detail: { mediaType: MediaType; id: number };
  BookDetail: { workId: number; book?: Partial<BookSummary> };
  Season: { tvId: number; seasonNumber: number; tvName: string };
  Person: { personId: number; name: string };
  CategoryList: { title: string; feed: FeedDescriptor };
  Search: { mediaOnly?: boolean } | undefined;
  Lists: undefined;
  ListDetail: { listId: string };
  Diary: undefined;
  Likes: undefined;
  Reviews: undefined;
  AllReviews: { mediaType: MediaType; id: number; title: string };
  EditProfile: undefined;
  Settings: undefined;
  Conversation: { userId: string };
  People: { initialFilter?: PeopleFilter; shareMedia?: { mediaType: ReviewMediaType; mediaId: number; title: string; posterPath: string | null; rating: number; overview?: string | null } } | undefined;
  Notifications: undefined;
  UserProfile: { userId: string };
  ReviewModal: {
    mediaType: ReviewMediaType;
    mediaId: number;
    title: string;
    posterPath: string | null;
    genreIds?: number[];
    entryId?: string;
  };
  AddToList: {
    mediaType: ReviewMediaType;
    mediaId: number;
    title: string;
    posterPath: string | null;
    genreIds?: number[];
  };
};

export interface MockUser {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarColor: string;
  favoriteGenre: string;
  followsYou: boolean;
}

export interface SocialReviewComment {
  id: string;
  authorName: string;
  text: string;
  createdAt: number;
}

export interface SocialReview {
  id: string;
  userId: string;
  mediaType: 'movie' | 'tv';
  mediaId: number;
  title: string;
  posterPath: string | null;
  rating: number;
  text: string;
  createdAt: number;
  likes: number;
  likedByMe: boolean;
  comments: SocialReviewComment[];
}

export type MessageSender = 'me' | string;

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  text: string;
  createdAt: number;
}

export interface Conversation {
  userId: string;
  messages: ChatMessage[];
  unread: number;
}

export type PeopleFilter = 'all' | 'following' | 'followers';

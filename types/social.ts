export interface MockUser {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarColor: string;
  favoriteGenre: string;
  followsYou: boolean;
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

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MockUser, ChatMessage, Conversation, SocialReview, SocialReviewComment } from '../types/social';

export const MOCK_USERS: MockUser[] = [
  { id: 'u1', username: 'nova_reels', displayName: 'Nova', bio: 'Sci-fi obsessed. Currently marathoning anything Denis Villeneuve.', avatarColor: '#33D6A6', favoriteGenre: 'Sci-Fi', followsYou: true },
  { id: 'u2', username: 'kaiju_kate', bio: 'Horror + kaiju flicks. Godzilla apologist.', displayName: 'Kate', avatarColor: '#FF9F43', favoriteGenre: 'Horror', followsYou: true },
  { id: 'u3', username: 'ren_anime', displayName: 'Ren', bio: 'Anime every day. Currently on three seasonal shows at once.', avatarColor: '#4EA8DE', favoriteGenre: 'Anime', followsYou: true },
  { id: 'u4', username: 'plot_twist_paz', displayName: 'Paz', bio: 'Thriller fanatic. I will spoil nothing... maybe.', avatarColor: '#FF5C7A', favoriteGenre: 'Thriller', followsYou: false },
  { id: 'u5', username: 'cinephile_leo', displayName: 'Leo', bio: 'Criterion Collection completionist. Ask me about French New Wave.', avatarColor: '#B48CFF', favoriteGenre: 'Drama', followsYou: true },
  { id: 'u6', username: 'popcorn_priya', displayName: 'Priya', bio: 'Rom-coms and feel-good movies only, thank you very much.', avatarColor: '#FFC94D', favoriteGenre: 'Romance', followsYou: false },
  { id: 'u7', username: 'noir_natasha', displayName: 'Natasha', bio: 'Black and white classics enjoyer. Bogart > everyone.', avatarColor: '#33D6A6', favoriteGenre: 'Noir', followsYou: false },
  { id: 'u8', username: 'tv_binge_tom', displayName: 'Tom', bio: 'One more episode... always. Currently 4 shows deep.', avatarColor: '#FF9F43', favoriteGenre: 'Drama', followsYou: true },
  { id: 'u9', username: 'directors_cut_dan', displayName: 'Dan', bio: 'Cinematography nerd. Framing matters more than plot.', avatarColor: '#4EA8DE', favoriteGenre: 'Drama', followsYou: true },
  { id: 'u10', username: 'anime_aria', displayName: 'Aria', bio: 'Studio Ghibli superfan. Totoro rights activist.', avatarColor: '#FF5C7A', favoriteGenre: 'Anime', followsYou: true },
  { id: 'u11', username: 'marvel_mo', displayName: 'Mo', bio: 'MCU timeline defender. Phase 6 optimist.', avatarColor: '#B48CFF', favoriteGenre: 'Action', followsYou: false },
  { id: 'u12', username: 'indie_iris', displayName: 'Iris', bio: 'A24 and indie darlings. Slow cinema enthusiast.', avatarColor: '#FFC94D', favoriteGenre: 'Indie', followsYou: false },
];

const DEFAULT_FOLLOWING = ['u1', 'u2', 'u3', 'u5', 'u8', 'u10'];

const REPLY_LINES = [
  "Okay I NEED to watch that now.",
  "Adding it to my watchlist right now 👀",
  "Wait, what did you rate it?",
  "No spoilers please, I'm only halfway through 😭",
  "That's such an underrated pick.",
  "I was up till 2am finishing that last night.",
  "10/10, one of my favorites this year.",
  "The ending completely wrecked me.",
  "Have you seen the sequel yet?",
  "I keep meaning to log that in my diary.",
  "Honestly the cinematography alone is worth it.",
  "That's going straight into my next list.",
  "Ugh I've been putting that off, might binge it this weekend.",
  "The soundtrack for that one is incredible btw.",
  "Lowkey think it's better than everyone says.",
];

function pickReply() {
  return REPLY_LINES[Math.floor(Math.random() * REPLY_LINES.length)];
}

function hashCount(id: string, min: number, max: number) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100000;
  return min + (h % (max - min));
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

const SEED_REVIEWS: SocialReview[] = [
  { id: 'review-u1-969681', userId: 'u1', mediaType: 'movie', mediaId: 969681, title: 'Spider-Man: Brand New Day', posterPath: '/bjiS5ipwxb9JFy3XRRN4OAilSeX.jpg', rating: 9, text: 'The emotional core surprised me. Big superhero energy, but the quiet Peter moments are what stayed with me.', createdAt: Date.now() - 1000 * 60 * 38, likes: 14, likedByMe: false, comments: [{ id: 'comment-1', authorName: 'You', text: 'Adding this to my weekend watchlist.', createdAt: Date.now() - 1000 * 60 * 20 }] },
  { id: 'review-u2-550', userId: 'u2', mediaType: 'movie', mediaId: 550, title: 'Fight Club', posterPath: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', rating: 8, text: 'Still unsettling, stylish, and wildly rewatchable. The production design does so much work.', createdAt: Date.now() - 1000 * 60 * 60 * 3, likes: 27, likedByMe: false, comments: [] },
  { id: 'review-u3-19995', userId: 'u3', mediaType: 'movie', mediaId: 19995, title: 'Avatar', posterPath: '/kyeqWdyUXW608qlYkRqosgbbJyK.jpg', rating: 8, text: 'The world-building remains incredible on a big screen. I came for the visuals and stayed for the creatures.', createdAt: Date.now() - 1000 * 60 * 60 * 7, likes: 19, likedByMe: false, comments: [{ id: 'comment-2', authorName: 'Ren', text: 'The soundtrack is still perfect.', createdAt: Date.now() - 1000 * 60 * 60 * 6 }] },
  { id: 'review-u5-872585', userId: 'u5', mediaType: 'movie', mediaId: 872585, title: 'Oppenheimer', posterPath: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', rating: 10, text: 'A monumental character study with tension in every conversation. The sound design is unforgettable.', createdAt: Date.now() - 1000 * 60 * 60 * 12, likes: 41, likedByMe: false, comments: [] },
  { id: 'review-u8-693134', userId: 'u8', mediaType: 'movie', mediaId: 693134, title: 'Dune: Part Two', posterPath: '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', rating: 9, text: 'Operatic, patient, and enormous. This is exactly the kind of film that rewards a second viewing.', createdAt: Date.now() - 1000 * 60 * 60 * 20, likes: 33, likedByMe: false, comments: [] },
];

const SEED_CONVERSATIONS: Record<string, Conversation> = {
  u1: {
    userId: 'u1',
    unread: 2,
    messages: [
      { id: uid(), sender: 'u1', text: "Have you watched the new sci-fi trailer that dropped?", createdAt: Date.now() - 1000 * 60 * 60 * 5 },
      { id: uid(), sender: 'u1', text: "The visuals look absolutely insane.", createdAt: Date.now() - 1000 * 60 * 60 * 4 },
    ],
  },
  u3: {
    userId: 'u3',
    unread: 1,
    messages: [
      { id: uid(), sender: 'me', text: "What are you watching this season?", createdAt: Date.now() - 1000 * 60 * 60 * 26 },
      { id: uid(), sender: 'u3', text: "Three shows at once as usual lol, I'll send you my list", createdAt: Date.now() - 1000 * 60 * 60 * 25 },
      { id: uid(), sender: 'u3', text: "You'd love the new one that just started airing", createdAt: Date.now() - 1000 * 60 * 60 * 2 },
    ],
  },
  u8: {
    userId: 'u8',
    unread: 0,
    messages: [
      { id: uid(), sender: 'u8', text: "Finished the whole season in one sitting last night 💀", createdAt: Date.now() - 1000 * 60 * 60 * 48 },
      { id: uid(), sender: 'me', text: "No way, no spoilers!! I'm only on episode 4", createdAt: Date.now() - 1000 * 60 * 60 * 47 },
      { id: uid(), sender: 'u8', text: "Lips sealed 🤐 but hurry up and catch up", createdAt: Date.now() - 1000 * 60 * 60 * 46 },
    ],
  },
};

interface SocialContextValue {
  loaded: boolean;
  users: MockUser[];
  followingIds: Record<string, boolean>;
  conversations: Record<string, Conversation>;
  typingUserIds: Record<string, boolean>;
  isFollowing: (userId: string) => boolean;
  toggleFollow: (userId: string) => void;
  getUser: (userId: string) => MockUser | undefined;
  getConversation: (userId: string) => Conversation;
  sendMessage: (userId: string, text: string) => void;
  markRead: (userId: string) => void;
  reviews: SocialReview[];
  toggleReviewLike: (reviewId: string) => void;
  addReviewComment: (reviewId: string, text: string) => void;
  deleteConversation: (userId: string) => void;
  followerCountFor: (userId: string) => number;
  followingCountFor: (userId: string) => number;
  totalUnread: number;
  myFollowingCount: number;
  myFollowerCount: number;
}

const SocialContext = createContext<SocialContextValue | undefined>(undefined);

const KEYS = {
  following: '@reelog/social/following',
  conversations: '@reelog/social/conversations',
  reviews: '@reelog/social/reviews',
};

export function SocialProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [followingIds, setFollowingIds] = useState<Record<string, boolean>>(
    Object.fromEntries(DEFAULT_FOLLOWING.map((id) => [id, true]))
  );
  const [conversations, setConversations] = useState<Record<string, Conversation>>(SEED_CONVERSATIONS);
  const [reviews, setReviews] = useState<SocialReview[]>(SEED_REVIEWS);
  const [typingUserIds, setTypingUserIds] = useState<Record<string, boolean>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>[]>>({});

  useEffect(() => {
    (async () => {
      try {
        const [f, c, r] = await Promise.all([
          AsyncStorage.getItem(KEYS.following),
          AsyncStorage.getItem(KEYS.conversations),
          AsyncStorage.getItem(KEYS.reviews),
        ]);
        if (f) setFollowingIds(JSON.parse(f));
        if (c) setConversations(JSON.parse(c));
        if (r) setReviews(JSON.parse(r));
      } catch (err) {
        console.warn('Failed to load social data', err);
      } finally {
        setLoaded(true);
      }
    })();
    return () => {
      Object.values(timers.current).forEach((arr) => arr.forEach(clearTimeout));
    };
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEYS.following, JSON.stringify(followingIds));
  }, [followingIds, loaded]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEYS.conversations, JSON.stringify(conversations));
  }, [conversations, loaded]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEYS.reviews, JSON.stringify(reviews));
  }, [reviews, loaded]);

  const getUser = useCallback((userId: string) => MOCK_USERS.find((u) => u.id === userId), []);

  const isFollowing = useCallback((userId: string) => !!followingIds[userId], [followingIds]);

  const toggleFollow = useCallback((userId: string) => {
    setFollowingIds((prev) => {
      const next = { ...prev };
      if (next[userId]) delete next[userId];
      else next[userId] = true;
      return next;
    });
  }, []);

  const getConversation = useCallback(
    (userId: string): Conversation => conversations[userId] ?? { userId, messages: [], unread: 0 },
    [conversations]
  );

  const markRead = useCallback((userId: string) => {
    setConversations((prev) => {
      const existing = prev[userId];
      if (!existing || existing.unread === 0) return prev;
      return { ...prev, [userId]: { ...existing, unread: 0 } };
    });
  }, []);

  const deleteConversation = useCallback((userId: string) => {
    setConversations((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  const sendMessage = useCallback((userId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const myMessage: ChatMessage = { id: uid(), sender: 'me', text: trimmed, createdAt: Date.now() };
    setConversations((prev) => {
      const existing = prev[userId] ?? { userId, messages: [], unread: 0 };
      return { ...prev, [userId]: { ...existing, messages: [...existing.messages, myMessage], unread: 0 } };
    });

    const typingDelay = 700 + Math.random() * 600;
    const replyDelay = typingDelay + 900 + Math.random() * 1400;

    const t1 = setTimeout(() => {
      setTypingUserIds((prev) => ({ ...prev, [userId]: true }));
    }, typingDelay);

    const t2 = setTimeout(() => {
      setTypingUserIds((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      const reply: ChatMessage = { id: uid(), sender: userId, text: pickReply(), createdAt: Date.now() };
      setConversations((prev) => {
        const existing = prev[userId] ?? { userId, messages: [], unread: 0 };
        return { ...prev, [userId]: { ...existing, messages: [...existing.messages, reply], unread: 0 } };
      });
    }, replyDelay);

    timers.current[userId] = [...(timers.current[userId] ?? []), t1, t2];
  }, []);

  const toggleReviewLike = useCallback((reviewId: string) => {
    setReviews((prev) => prev.map((review) => review.id === reviewId ? { ...review, likedByMe: !review.likedByMe, likes: review.likes + (review.likedByMe ? -1 : 1) } : review));
  }, []);

  const addReviewComment = useCallback((reviewId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const comment: SocialReviewComment = { id: uid(), authorName: 'You', text: trimmed, createdAt: Date.now() };
    setReviews((prev) => prev.map((review) => review.id === reviewId ? { ...review, comments: [...review.comments, comment] } : review));
  }, []);

  const followerCountFor = useCallback((userId: string) => hashCount(userId, 120, 4200), []);
  const followingCountFor = useCallback((userId: string) => hashCount(userId + 'f', 40, 900), []);

  const totalUnread = useMemo(
    () => Object.values(conversations).reduce((sum, c) => sum + c.unread, 0),
    [conversations]
  );

  const myFollowingCount = useMemo(() => Object.keys(followingIds).length, [followingIds]);
  const myFollowerCount = useMemo(() => MOCK_USERS.filter((u) => u.followsYou).length, []);

  const value: SocialContextValue = {
    loaded,
    users: MOCK_USERS,
    followingIds,
    conversations,
    typingUserIds,
    isFollowing,
    toggleFollow,
    getUser,
    getConversation,
    sendMessage,
    markRead,
    deleteConversation,
    reviews,
    toggleReviewLike,
    addReviewComment,
    followerCountFor,
    followingCountFor,
    totalUnread,
    myFollowingCount,
    myFollowerCount,
  };

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial() {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error('useSocial must be used within SocialProvider');
  return ctx;
}

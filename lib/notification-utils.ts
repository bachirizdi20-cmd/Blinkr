export type NotificationKind = 'follow' | 'like' | 'comment' | 'message';
export type NotificationFilter = 'all' | 'mentions' | 'likes' | 'comments' | 'follows' | 'messages';

export const NOTIFICATION_COPY: Record<NotificationKind, string> = {
  follow: 'started following you',
  like: 'liked your review',
  comment: 'commented on your review',
  message: 'sent you a message',
};

export function matchesNotificationFilter(kind: NotificationKind, filter: NotificationFilter) {
  if (filter === 'all') return true;
  if (filter === 'mentions') return false;
  const expectedKind: NotificationKind = filter === 'messages' ? 'message' : filter.slice(0, -1) as NotificationKind;
  return kind === expectedKind;
}

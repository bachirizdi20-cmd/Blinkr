export type NotificationKind = 'follow' | 'like' | 'comment' | 'message';
export type NotificationFilter = 'all' | 'likes' | 'comments' | 'follows' | 'messages';

export const NOTIFICATION_COPY: Record<NotificationKind, string> = {
  follow: 'بدأ بمتابعتك',
  like: 'أعجب بمراجعتك',
  comment: 'علّق على مراجعتك',
  message: 'أرسل إليك رسالة',
};

export function matchesNotificationFilter(kind: NotificationKind, filter: NotificationFilter) {
  if (filter === 'all') return true;
  const expectedKind: NotificationKind = filter === 'messages' ? 'message' : filter.slice(0, -1) as NotificationKind;
  return kind === expectedKind;
}

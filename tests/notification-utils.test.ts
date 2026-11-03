import { describe, expect, it } from 'vitest';
import { matchesNotificationFilter, NOTIFICATION_COPY } from '../lib/notification-utils';

describe('notification utilities', () => {
  it('describes message notifications separately from review comments', () => {
    expect(NOTIFICATION_COPY.message).toBe('أرسل إليك رسالة');
    expect(NOTIFICATION_COPY.comment).toBe('علّق على مراجعتك');
  });

  it('matches the messages filter without matching comments', () => {
    expect(matchesNotificationFilter('message', 'messages')).toBe(true);
    expect(matchesNotificationFilter('comment', 'messages')).toBe(false);
    expect(matchesNotificationFilter('message', 'comments')).toBe(false);
    expect(matchesNotificationFilter('message', 'all')).toBe(true);
  });
});

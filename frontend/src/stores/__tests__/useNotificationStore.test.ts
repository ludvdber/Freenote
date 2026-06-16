import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore } from '../useNotificationStore';

const reset = () => useNotificationStore.setState({ notifications: [] });

describe('useNotificationStore', () => {
  beforeEach(reset);

  it('pushes a notification with generated id/createdAt/read=false', () => {
    useNotificationStore.getState().push({ type: 'info', messageKey: 'x' });
    const list = useNotificationStore.getState().notifications;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ type: 'info', messageKey: 'x', read: false });
    expect(list[0].id).toBeTruthy();
    expect(typeof list[0].createdAt).toBe('number');
  });

  it('prepends newest first and caps at 50', () => {
    const { push } = useNotificationStore.getState();
    for (let i = 0; i < 55; i++) push({ type: 'info', messageKey: `m${i}` });
    const list = useNotificationStore.getState().notifications;
    expect(list).toHaveLength(50);
    expect(list[0].messageKey).toBe('m54'); // newest first
  });

  it('counts unread and marks all read', () => {
    const s = useNotificationStore.getState();
    s.push({ type: 'success', messageKey: 'a' });
    s.push({ type: 'warning', messageKey: 'b' });
    expect(useNotificationStore.getState().unreadCount()).toBe(2);

    useNotificationStore.getState().markAllRead();
    expect(useNotificationStore.getState().unreadCount()).toBe(0);
    expect(useNotificationStore.getState().notifications.every((n) => n.read)).toBe(true);
  });

  it('clears all notifications', () => {
    useNotificationStore.getState().push({ type: 'info', messageKey: 'a' });
    useNotificationStore.getState().clear();
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });
});

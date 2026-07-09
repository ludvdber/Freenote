import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCelebrationStore } from '@/stores/useCelebrationStore';
import { getNotificationsUnreadCount, getCurrentUser } from '@/api/endpoints';
import type { NotificationItem } from '@/types';

/**
 * Opens a Server-Sent Events connection to `/api/notifications/stream` while the user
 * is authenticated. Every pushed event invalidates the React Query caches (badge + liste),
 * so `NotificationBell` — branchée sur l'historique persisté serveur — se met à jour
 * instantanément. On network error the browser's `EventSource` reconnects automatically
 * after ~3s — we also refetch the unread count on reconnect.
 */
export function useNotificationsStream() {
  const token = useAuthStore((s) => s.token);
  // The stream endpoint requires ROLE_VERIFIED. Opening it for an authenticated-but-unverified
  // account yields a 403 that EventSource retries every ~3s (reconnect storm) — gate on verified.
  const isVerified = useAuthStore((s) => s.isVerified);
  const queryClient = useQueryClient();

  // Unread count — polled as a safety net in case SSE drops for a long time.
  useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getNotificationsUnreadCount,
    enabled: !!token && isVerified,
    refetchInterval: 60_000, // 60s safety poll; SSE is the primary channel
  });

  useEffect(() => {
    if (!token || !isVerified) return;

    const source = new EventSource('/api/notifications/stream', { withCredentials: true });

    source.addEventListener('notification', (event) => {
      // La notification est déjà persistée côté serveur — invalider suffit (badge + liste).
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      // Moment de lumière : un doc vérifié déclenche le toast céleste (+10 XP) et resynchronise
      // l'XP du store — c'est aussi ce qui fait tirer la célébration de palier
      // (useLevelCelebration observe user.xp).
      try {
        const dto = JSON.parse((event as MessageEvent).data) as NotificationItem;
        if (dto.type === 'document.verified') {
          useCelebrationStore.getState().showToast({ title: String(dto.payload?.title ?? ''), xp: 10 });
          getCurrentUser()
            .then((me) => useAuthStore.getState().setUser(me))
            .catch(() => {});
        }
      } catch {
        // Payload inattendu — la cloche (historique serveur) reste la source de vérité.
      }
    });

    source.onerror = () => {
      // EventSource auto-reconnects under the hood. Refresh the unread count so a long
      // drop (events missed while disconnected) can't leave the badge stale.
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    };

    return () => source.close();
  }, [token, isVerified, queryClient]);
}

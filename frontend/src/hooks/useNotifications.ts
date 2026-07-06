import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getNotificationsUnreadCount, markAllNotificationsRead } from '@/api/endpoints';
import { useAuthStore } from '@/stores/useAuthStore';

/**
 * Compteur non-lus SERVEUR — la source de vérité du badge (survit au reload, contrairement à
 * l'ancien store local de session). Rafraîchi par le poll de useNotificationsStream et invalidé
 * à chaque événement SSE.
 */
export function useUnreadNotificationsCount(): number {
  const token = useAuthStore((s) => s.token);
  const isVerified = useAuthStore((s) => s.isVerified);
  const { data } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getNotificationsUnreadCount,
    enabled: !!token && isVerified,
  });
  return data ?? 0;
}

/** Marque tout lu CÔTÉ SERVEUR puis invalide badge + liste. */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

import { useState } from 'react';
import { IconButton, Badge as MuiBadge, Popover, Typography, Box, ButtonBase } from '@mui/material';
import { Notifications } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getNotifications } from '@/api/endpoints';
import { useAuthStore } from '@/stores/useAuthStore';
import { useMarkAllNotificationsRead, useUnreadNotificationsCount } from '@/hooks/useNotifications';
import { SleepyMoon } from '@/components/ui/EmptySky';
import { formatRelativeDate } from '@/lib/utils';
import type { NotificationItem } from '@/types';
import * as s from './NotificationBell.styles';

const TYPE_ICONS: Record<string, string> = {
  'document.verified': '⭐',
  'quiz.questionReported': '🚩',
};

/** Cible de navigation d'une notification (null = ligne non cliquable). */
function targetFor(n: NotificationItem): string | null {
  if (n.type === 'document.verified' && n.payload?.documentId != null) return `/documents/${n.payload.documentId}`;
  if (n.type === 'quiz.questionReported') return '/outils/quiz';
  return null;
}

/**
 * Cloche + vrai panneau de notifications (remplace l'ancien Menu minimal — maquette « Moments de
 * lumière ») : lignes typées avec icône + heure relative, non-lu marqué au liseré cyan, état vide
 * illustré (lune EmptySky). Le « tout lu » part à la FERMETURE du panneau : pendant qu'il est
 * ouvert, les lignes non lues restent marquées (pas de course entre le fetch et l'invalidation).
 */
export default function NotificationBell() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const token = useAuthStore((st) => st.token);
  const isVerified = useAuthStore((st) => st.isVerified);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const count = useUnreadNotificationsCount();
  const markAllRead = useMarkAllNotificationsRead();
  const { data } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => getNotifications(0, 10),
    enabled: open && !!token && isVerified,
  });
  const items = data?.content ?? [];

  const handleClose = () => {
    setAnchorEl(null);
    if (count > 0) markAllRead.mutate();
  };

  const openItem = (n: NotificationItem) => {
    const target = targetFor(n);
    if (!target) return;
    handleClose();
    navigate(target);
  };

  return (
    <>
      <IconButton
        size="small"
        color="inherit"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-label={t('notifications.title')}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <MuiBadge badgeContent={count} color="error" max={9}>
          <Notifications fontSize="small" />
        </MuiBadge>
      </IconButton>

      <Popover
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: s.panel } }}
      >
        <Box sx={s.header}>
          {t('notifications.title')}
          {count > 0 && (
            <Typography variant="caption" color="text.secondary">
              {t('notifications.unreadCount', { count })}
            </Typography>
          )}
        </Box>

        {items.length === 0 ? (
          <Box sx={s.empty}>
            <SleepyMoon />
            <Typography variant="body2" color="text.secondary">
              {t('notifications.empty')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, opacity: 0.8 }}>
              {t('notifications.emptyHint')}
            </Typography>
          </Box>
        ) : (
          <Box sx={s.list}>
            {items.map((n) => {
              const clickable = targetFor(n) !== null;
              return (
                <ButtonBase
                  key={n.id}
                  component="div"
                  disabled={!clickable}
                  onClick={() => openItem(n)}
                  sx={s.row(!n.read)}
                >
                  <Box sx={s.rowIcon} aria-hidden="true">{TYPE_ICONS[n.type] ?? '🔔'}</Box>
                  <Typography sx={s.rowText}>
                    {t(`notifications.${n.type}`, n.payload)}
                  </Typography>
                  <Typography sx={s.rowTime}>
                    {formatRelativeDate(n.createdAt, i18n.language)}
                  </Typography>
                </ButtonBase>
              );
            })}
          </Box>
        )}
      </Popover>
    </>
  );
}

import { useState } from 'react';
import { IconButton, Badge as MuiBadge, Menu, MenuItem, Typography, Box } from '@mui/material';
import { Notifications } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getNotifications } from '@/api/endpoints';
import { useAuthStore } from '@/stores/useAuthStore';
import { useMarkAllNotificationsRead, useUnreadNotificationsCount } from '@/hooks/useNotifications';

export default function NotificationBell() {
  const { t, i18n } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const isVerified = useAuthStore((s) => s.isVerified);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // Badge + liste = historique persisté serveur (plus le store local de session, qui repartait à
  // zéro à chaque reload et laissait la table `notifications` inutilisée).
  const count = useUnreadNotificationsCount();
  const markAllRead = useMarkAllNotificationsRead();
  const { data } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => getNotifications(0, 10),
    enabled: open && !!token && isVerified,
  });
  const items = data?.content ?? [];

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    if (count > 0) markAllRead.mutate();
  };

  return (
    <>
      <IconButton
        size="small"
        color="inherit"
        onClick={handleOpen}
        aria-label={t('notifications.title')}
      >
        <MuiBadge badgeContent={count} color="error" max={9}>
          <Notifications fontSize="small" />
        </MuiBadge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { minWidth: 280, maxHeight: 360 } } }}
      >
        {items.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              {t('notifications.empty')}
            </Typography>
          </MenuItem>
        ) : (
          items.map((n) => (
            <MenuItem key={n.id} sx={{ whiteSpace: 'normal', py: 1 }}>
              <Box>
                <Typography variant="body2">
                  {t(`notifications.${n.type}`, n.payload)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(n.createdAt).toLocaleString(
                    i18n.language.startsWith('fr') ? 'fr-BE' : 'en-GB',
                    { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
                  )}
                </Typography>
              </Box>
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}

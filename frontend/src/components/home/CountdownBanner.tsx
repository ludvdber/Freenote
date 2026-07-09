import { Box, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getCountdown } from '@/api/endpoints';
import { daysUntil } from '@/lib/utils';
import { STALE_15M } from '@/lib/constants';

/**
 * Bannière « Rentrée dans N jours » de la home — publique, pilotée par l'admin (onglet Réglages).
 * Auto-masquée quand aucune date n'est configurée OU que la date est passée (aucune action
 * manuelle à la rentrée) ; réutilisable chaque année et pour d'autres échéances (sessions…).
 */
const bannerSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  px: 2.5,
  py: 1.25,
  mt: 3,
  borderRadius: 3.5,
  background: (th: { palette: { mode: string } }) =>
    th.palette.mode === 'dark'
      ? 'linear-gradient(135deg, rgba(0,210,255,0.08), rgba(123,47,247,0.08))'
      : 'linear-gradient(135deg, rgba(0,150,199,0.07), rgba(123,47,247,0.07))',
  border: (th: { palette: { mode: string } }) =>
    `1px solid ${th.palette.mode === 'dark' ? 'rgba(0,210,255,0.25)' : 'rgba(0,150,199,0.3)'}`,
} as const;

export default function CountdownBanner() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['countdown'],
    queryFn: getCountdown,
    staleTime: STALE_15M,
  });

  // Anti-CLS : la bannière est tout en haut de la home — apparaître après le fetch poussait toute
  // la page vers le bas. On réserve sa hauteur pendant le chargement (invisible), et on ne rend
  // rien qu'une fois certain qu'elle est désactivée.
  if (isLoading) {
    return (
      <Box sx={{ ...bannerSx, visibility: 'hidden' }} aria-hidden="true">
        <Typography variant="body2" sx={{ fontWeight: 700 }}>&nbsp;</Typography>
      </Box>
    );
  }

  if (!data?.date) return null;
  const days = daysUntil(data.date);
  if (days < 0) return null;
  const label = data.label?.trim() || t('home.countdown.defaultLabel');

  return (
    <Box sx={bannerSx}>
      <Typography component="span" aria-hidden="true">🎒</Typography>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {days === 0
          ? t('home.countdown.today', { label })
          : t('home.countdown.inDays', { label, count: days })}
      </Typography>
    </Box>
  );
}

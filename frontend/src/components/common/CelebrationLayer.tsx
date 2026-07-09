import { Box, Typography, Button, Snackbar, Dialog, IconButton, useTheme } from '@mui/material';
import { Close } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useCelebrationStore } from '@/stores/useCelebrationStore';
import { levelColor } from '@/lib/levels';
import * as s from './CelebrationLayer.styles';

/**
 * Couche de célébration globale (montée une fois dans App, pattern AuthPromptSnackbar) :
 * — toast « document vérifié » (+10 XP) : poussé par l'événement SSE (useNotificationsStream) ;
 * — modal de passage de palier : la constellation se dessine (1,2 s), poussée par useLevelCelebration.
 * Les étoiles de la constellation reprennent les couleurs de la maquette ; le libellé reste sobre.
 */
export default function CelebrationLayer() {
  const { t } = useTranslation();
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const toast = useCelebrationStore((st) => st.toast);
  const dismissToast = useCelebrationStore((st) => st.dismissToast);
  const levelUp = useCelebrationStore((st) => st.levelUp);
  const dismissLevelUp = useCelebrationStore((st) => st.dismissLevelUp);

  return (
    <>
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={7000}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') dismissToast();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={s.toast(dark)} role="status">
          <Box sx={s.toastIcon} aria-hidden="true">
            ⭐
            <Box sx={s.zipStar(dark)} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={s.toastTitle}>
              {t('notifications.document.verified', { title: toast?.title ?? '' })}
            </Typography>
            <Typography sx={s.toastSub}>{t('celebrations.verifiedSubtitle')}</Typography>
          </Box>
          <Box sx={s.xpChip}>{t('celebrations.xpChip', { xp: toast?.xp ?? 0 })}</Box>
          <IconButton size="small" onClick={dismissToast} aria-label={t('common.close')} sx={{ flexShrink: 0 }}>
            <Close fontSize="small" />
          </IconButton>
        </Box>
      </Snackbar>

      <Dialog open={Boolean(levelUp)} onClose={dismissLevelUp} maxWidth="xs" fullWidth>
        {levelUp && (
          <Box sx={s.levelCard(dark)}>
            <Box component="svg" viewBox="0 0 190 110" sx={s.drawSvg} aria-hidden="true">
              <line x1="28" y1="82" x2="76" y2="34" />
              <line x1="76" y1="34" x2="128" y2="58" />
              <line x1="128" y1="58" x2="166" y2="22" />
              <circle cx="28" cy="82" r="3.5" fill={dark ? '#7dd8ff' : '#0091b3'} />
              <circle cx="76" cy="34" r="4.5" fill={dark ? '#ffffff' : '#1e2948'} />
              <circle cx="128" cy="58" r="3.5" fill={dark ? '#c9a8ff' : '#6a1be0'} />
              <circle cx="166" cy="22" r="5" fill={dark ? '#ffd166' : '#ca8a04'} />
            </Box>
            <Typography sx={s.eyebrow}>{t('celebrations.levelUpEyebrow')}</Typography>
            <Typography variant="h4" component="h2" sx={s.levelName(levelColor(levelUp, theme.palette.mode), levelUp.gradient)}>
              {t(`levels.${levelUp.key}`)}
            </Typography>
            <Typography sx={s.levelBody}>
              {t('celebrations.levelUpBody', { xp: levelUp.minXp })}
            </Typography>
            <Button variant="contained" onClick={dismissLevelUp}>
              {t('celebrations.continue')}
            </Button>
          </Box>
        )}
      </Dialog>
    </>
  );
}

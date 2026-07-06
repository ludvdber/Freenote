import { Box, LinearProgress, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { levelProgress, levelColor } from '@/lib/levels';

/** Barre de progression vers le prochain palier céleste — « 480 / 720 XP → Supernova ».
 *  Utilisée dans « Ta position » (classement) et la carte Statistiques du profil. */
export default function LevelProgress({ xp }: { xp: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { current, next, ratio } = levelProgress(xp);
  const color = levelColor(current, theme.palette.mode);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color }}>
          {t(`levels.${current.key}`)}
        </Typography>
        {next && (
          <Typography variant="caption" color="text.secondary">
            {t(`levels.${next.key}`)}
          </Typography>
        )}
      </Box>
      <LinearProgress
        variant="determinate"
        value={ratio * 100}
        aria-label={next ? t('levels.progressTo', { next: t(`levels.${next.key}`) }) : t('levels.tooltipMax')}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: `${color}22`,
          '& .MuiLinearProgress-bar': {
            borderRadius: 3,
            background: next ? color : (current.gradient ?? color),
          },
        }}
      />
      <Typography variant="caption" color="text.secondary" className="mono" sx={{ display: 'block', mt: 0.5 }}>
        {next ? `${xp} / ${next.minXp} XP` : t('levels.tooltipMax')}
      </Typography>
    </Box>
  );
}

/* eslint-disable react-refresh/only-export-components --
   levelNameSx is a tiny style helper tied to this component's visual language (tier-colored
   usernames); exporting it here keeps the tier styling in one place. */
import { Chip, Tooltip, useTheme } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { levelFor, levelProgress, levelColor } from '@/lib/levels';

/** Sx pour colorer un pseudo à la couleur du palier (dégradé texte pour Galaxie). */
export function levelNameSx(xp: number, mode: 'light' | 'dark'): SxProps<Theme> {
  const level = levelFor(xp);
  if (level.gradient) {
    return {
      background: level.gradient,
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    };
  }
  return { color: levelColor(level, mode) };
}

interface Props {
  xp: number;
  /** Compact variant for table rows / tight card headers. */
  dense?: boolean;
}

/** Chip de palier céleste — affiché partout où l'XP apparaît (classement, profils, uploader). */
export default function LevelChip({ xp, dense = false }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const level = levelFor(xp);
  const color = levelColor(level, theme.palette.mode);
  const { next, remaining } = levelProgress(xp);
  const tooltip = next
    ? t('levels.tooltipNext', { remaining, next: t(`levels.${next.key}`) })
    : t('levels.tooltipMax');

  return (
    <Tooltip title={tooltip} enterDelay={300}>
      <Chip
        label={t(`levels.${level.key}`)}
        size="small"
        variant="outlined"
        sx={{
          height: dense ? 20 : 22,
          fontSize: dense ? 10 : 11,
          fontWeight: 700,
          color,
          borderColor: `${color}66`,
          bgcolor: `${color}14`,
          ...(level.gradient && {
            borderColor: 'rgba(123,47,247,0.4)',
            '& .MuiChip-label': {
              background: level.gradient,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            },
          }),
        }}
      />
    </Tooltip>
  );
}

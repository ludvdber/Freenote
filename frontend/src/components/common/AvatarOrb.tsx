import { useId } from 'react';
import { Box, Tooltip, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { levelFor, levelProgress } from '@/lib/levels';
import UserAvatar from './UserAvatar';

interface Props {
  username: string;
  url?: string | null;
  size?: number;
  xp: number;
}

/**
 * Avatar entouré de l'anneau de progression vers le prochain palier (maquette « Moments de
 * lumière ») : zéro clic pour savoir où on en est, le détail reste dans /profile. Anneau statique
 * (aucune animation en boucle), dégradé primary→secondary (suit la palette d'accent supporter).
 * Le tooltip porte l'info ; l'anneau lui-même est décoratif (aria-hidden).
 */
export default function AvatarOrb({ username, url, size = 40, xp }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const gradientId = useId();

  const level = levelFor(xp);
  const { next, ratio, remaining } = levelProgress(xp);
  const tooltip = next
    ? `${t(`levels.${level.key}`)} · ${xp}/${next.minXp} XP — ${t('levels.tooltipNext', { remaining, next: t(`levels.${next.key}`) })}`
    : `${t(`levels.${level.key}`)} · ${t('levels.tooltipMax')}`;

  // Anneau 4 px autour de l'avatar : boîte SVG = size + 8, rayon au centre du trait.
  const box = size + 8;
  const r = box / 2 - 1.5;
  const circumference = 2 * Math.PI * r;

  return (
    <Tooltip title={tooltip} enterDelay={300}>
      <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <Box
          component="svg"
          viewBox={`0 0 ${box} ${box}`}
          aria-hidden="true"
          sx={{ position: 'absolute', inset: -4, width: box, height: box, transform: 'rotate(-90deg)', pointerEvents: 'none' }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={theme.palette.primary.main} />
              <stop offset="1" stopColor={theme.palette.secondary.main} />
            </linearGradient>
          </defs>
          <circle
            cx={box / 2}
            cy={box / 2}
            r={r}
            fill="none"
            stroke={theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(10,14,26,0.12)'}
            strokeWidth="2.5"
          />
          <circle
            cx={box / 2}
            cy={box / 2}
            r={r}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
          />
        </Box>
        <UserAvatar username={username} url={url} size={size} />
      </Box>
    </Tooltip>
  );
}

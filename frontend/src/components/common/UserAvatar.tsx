import { Avatar, Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { accentGradient } from '@/theme/accent';

interface Props {
  username: string;
  url?: string | null;
  size?: number;
  fontSize?: number;
  sx?: SxProps<Theme>;
}

// Dégradé du thème actif : les cercles-lettres prennent la palette d'accent du SPECTATEUR
// (perk supporter) — purement décoratif, l'initiale reste l'identité.
const GRADIENT = (t: Theme) => accentGradient(t);

/**
 * Single source of truth for user avatars.
 * Renders an <img> when `url` is set (Google / GitHub CDN, DiceBear SVG),
 * otherwise a gradient circle with the first letter of the username.
 * MUI <Avatar> already falls back to children if the image fails to load,
 * so a broken CDN URL silently degrades to the letter avatar.
 */
export default function UserAvatar({ username, url, size = 40, fontSize, sx }: Props) {
  const initial = username.charAt(0).toUpperCase() || '?';
  const computedFontSize = fontSize ?? Math.round(size * 0.45);

  if (url) {
    return (
      <Avatar
        src={url}
        alt={username}
        sx={{
          width: size,
          height: size,
          fontSize: computedFontSize,
          fontWeight: 800,
          color: '#fff',
          background: GRADIENT,
          flexShrink: 0,
          ...sx,
        }}
      >
        {initial}
      </Avatar>
    );
  }

  return (
    <Box
      aria-label={username}
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: computedFontSize,
        fontWeight: 800,
        color: '#fff',
        background: GRADIENT,
        flexShrink: 0,
        ...sx,
      }}
    >
      {initial}
    </Box>
  );
}

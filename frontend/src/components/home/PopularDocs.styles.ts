import type { SxProps, Theme } from '@mui/material';
import { accentGradientAlpha } from '@/theme/accent';

type Sx = SxProps<Theme>;

export const section: Sx = { py: { xs: 6, md: 9 } };

export const row: Sx = {
  display: 'flex',
  gap: 3,
  flexDirection: { xs: 'column', md: 'row' },
  alignItems: 'stretch',
};

export const docsCol: Sx = {
  flex: { xs: '1 1 auto', md: '7 1 0' },
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
};

export const leaderboardCol: Sx = {
  flex: { xs: '1 1 auto', md: '5 1 0' },
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
};

export const colHeader: Sx = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  mb: 2,
};

export const colTitle: Sx = { fontWeight: 800 };

export const viewAllLink: Sx = {
  color: 'primary.main',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 700,
  '&:hover': { textDecoration: 'underline' },
};

export const listCard: Sx = { p: 0, flex: 1 };

// Colonne outils (aperçu anonyme) : la carte s'étire à la hauteur de la colonne catalogue (6 lignes),
// donc les tuiles GRANDISSENT (flex: 1) pour remplir — sans ça, grand vide sous le CTA.
export const toolsCard: Sx = { p: 0, flex: 1, display: 'flex', flexDirection: 'column' };

export const toolRow: Sx = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  px: 2.5,
  py: 1.5,
  borderBottom: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
  textDecoration: 'none',
  color: 'inherit',
  transition: 'background-color 0.15s',
  '&:hover': { bgcolor: 'action.hover' },
};

export const toolIcon: Sx = {
  width: 40,
  height: 40,
  borderRadius: 1.5,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: (t) => accentGradientAlpha(t, 0.18),
  color: 'primary.main',
  '& svg': { fontSize: 22 },
};

export const toolShort: Sx = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

export const toolsCta: Sx = { p: 2 };

export const docRow = (isFirst: boolean): Sx => ({
  display: 'flex',
  alignItems: 'center',
  gap: { xs: 1.5, sm: 2 },
  px: 2.5,
  py: 1.5,
  borderBottom: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
  '&:last-child': { borderBottom: 'none' },
  textDecoration: 'none',
  color: 'inherit',
  transition: 'background-color 0.15s',
  '&:hover': { bgcolor: 'action.hover' },
  ...(isFirst && {
    bgcolor: (t: Theme) => t.palette.mode === 'dark' ? 'rgba(0,210,255,0.04)' : 'rgba(0,210,255,0.03)',
  }),
});

export const rank: Sx = {
  fontWeight: 700,
  color: 'text.secondary',
  fontSize: 13,
  width: 20,
  textAlign: 'center',
  flexShrink: 0,
};

export const docInfo: Sx = { flex: 1, minWidth: 0, overflow: 'hidden' };

export const docTitle: Sx = { fontWeight: 700, lineHeight: 1.3 };

export const categoryChip = (color: string): Sx => ({
  bgcolor: `${color}15`,
  color,
  fontWeight: 600,
  fontSize: 10,
  height: 22,
  flexShrink: 0,
  display: { xs: 'none', sm: 'flex' },
});

export const verifiedIcon: Sx = {
  fontSize: 16,
  color: 'primary.main',
  flexShrink: 0,
  display: { xs: 'none', sm: 'block' },
};

export const dlCol: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  flexShrink: 0,
};

export const dlIcon: Sx = { fontSize: 14, color: 'text.secondary' };

export const medalCircle = (rank: number, color: string): Sx => ({
  width: 36,
  height: 36,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  bgcolor: rank <= 3 ? `${color}20` : 'transparent',
  flexShrink: 0,
});

export const xpCol: Sx = { textAlign: 'right', flexShrink: 0 };

export const xpValue: Sx = {
  fontWeight: 800,
  color: 'primary.main',
  fontSize: '1.1rem',
};

export const emptyState: Sx = { p: 4, textAlign: 'center' };

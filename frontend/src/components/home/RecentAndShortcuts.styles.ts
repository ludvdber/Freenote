import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

export const section: Sx = { py: { xs: 6, md: 9 } };

export const row: Sx = {
  display: 'flex',
  gap: 3,
  flexDirection: { xs: 'column', md: 'row' },
  alignItems: 'stretch',
};

export const col: Sx = {
  flex: '1 1 0',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
};

export const colTitle: Sx = { fontWeight: 800, mb: 2 };

export const card: Sx = { p: 2.5, flex: 1 };

export const recentList: Sx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
};

export const recentItem: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  p: 1.25,
  borderRadius: 1.5,
  textDecoration: 'none',
  color: 'inherit',
  transition: 'background-color 0.15s',
  '&:hover': {
    bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
  },
};

export const recentIcon: Sx = {
  width: 36,
  height: 36,
  borderRadius: 1.5,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 18,
  bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(123,47,247,0.15)' : 'rgba(123,47,247,0.08)',
  color: 'primary.main',
  flexShrink: 0,
};

export const recentMeta: Sx = {
  flex: 1,
  minWidth: 0,
};

export const recentTitle: Sx = {
  fontWeight: 600,
  fontSize: 14,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const recentSubtitle: Sx = {
  fontSize: 12,
  opacity: 0.7,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const empty: Sx = { p: 3, textAlign: 'center' };

/** La carte Accès rapide est une colonne flex : la grille absorbe TOUTE la hauteur de la carte,
 *  elle-même étirée à la hauteur de « Reprise de lecture » — plus de vide en bas quand la liste
 *  de lecture est longue (les tuiles grandissent avec `gridAutoRows: 1fr`). */
export const shortcutsCard: Sx = {
  p: 2.5,
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
};

export const shortcutsGrid: Sx = {
  display: 'grid',
  gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
  gridAutoRows: '1fr',
  flex: 1,
  gap: 1.5,
};

export const shortcutTile: Sx = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0.75,
  p: 2,
  borderRadius: 2,
  textDecoration: 'none',
  color: 'text.primary',
  bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
  border: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  transition: 'transform 0.15s, border-color 0.15s',
  '&:hover': {
    transform: 'translateY(-2px)',
    borderColor: 'primary.main',
  },
};

export const shortcutIcon: Sx = {
  color: 'primary.main',
  fontSize: 28,
};

export const shortcutLabel: Sx = {
  fontWeight: 600,
  fontSize: 13,
  textAlign: 'center',
};

import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

export const section: Sx = { py: { xs: 6, md: 9 } };

// stretch : les deux cartes doivent finir à la même hauteur (bas alignés). Chacune absorbe le
// surplus : la grille d'accès rapide espace ses rangées (alignContent), la liste Reprise centre
// son état vide — pas de grand vide en bas de carte.
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

export const card: Sx = { p: 2.5, flex: 1, display: 'flex', flexDirection: 'column' };

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

export const empty: Sx = { p: 3, textAlign: 'center', my: 'auto' };

export const shortcutsCard: Sx = {
  p: 2.5,
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
};

/** Grille 6 colonnes pour hiérarchiser sans rangée bancale : 2 primaires (span 3), 6 moyennes
 *  (span 2 = 3 par rangée), « Signaler un bug » en rangée fine pleine largeur (span 6) — les
 *  9 tuiles au même poids mettaient le bug report au niveau de « Partager un doc ».
 *  flex: 1 + alignContent space-between : la carte étirée (bas aligné sur « Reprise de lecture »)
 *  distribue le surplus ENTRE les rangées au lieu de le laisser en vide sous la dernière. */
export const shortcutsGrid: Sx = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, 1fr)',
  gap: 1.5,
  flex: 1,
  alignContent: 'space-between',
};

export const shortcutTile = (variant?: 'primary' | 'utility'): Sx => ({
  gridColumn: variant === 'utility' ? 'span 6' : variant === 'primary' ? 'span 3' : { xs: 'span 3', sm: 'span 2' },
  display: 'flex',
  flexDirection: variant === 'utility' ? 'row' : 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: variant === 'utility' ? 1 : 0.75,
  p: variant === 'primary' ? 2.5 : variant === 'utility' ? 1 : 2,
  height: '100%',
  borderRadius: 2,
  textDecoration: 'none',
  color: 'text.primary',
  bgcolor: (t) => variant === 'primary'
    ? (t.palette.mode === 'dark' ? 'rgba(0,212,255,0.06)' : 'rgba(0,145,179,0.06)')
    : (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
  border: (t) => `1px solid ${variant === 'primary'
    ? (t.palette.mode === 'dark' ? 'rgba(0,212,255,0.35)' : 'rgba(0,145,179,0.35)')
    : (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')}`,
  transition: 'transform 0.15s, border-color 0.15s',
  '&:hover': {
    transform: 'translateY(-2px)',
    borderColor: 'primary.main',
  },
});

export const shortcutIcon = (variant?: 'primary' | 'utility'): Sx => ({
  color: 'primary.main',
  fontSize: variant === 'primary' ? 34 : variant === 'utility' ? 18 : 28,
  lineHeight: 0,
});

export const shortcutLabel = (variant?: 'primary' | 'utility'): Sx => ({
  fontWeight: variant === 'primary' ? 700 : 600,
  fontSize: variant === 'primary' ? 14.5 : 13,
  textAlign: 'center',
});

import type { SxProps, Theme } from '@mui/material';
import type { CSSProperties } from 'react';
import { TOKENS } from '@/theme/tokens';

type Sx = SxProps<Theme>;

export const section: Sx = { py: { xs: 6, md: 9 } };

// Pleine largeur : l'ancienne colonne pub 300×250 laissait un grand vide à droite pour les
// supporters (pub masquée, colonne conservée). La pub de la home vit désormais en bas de page
// (AdSlot 728×90 dans Home.tsx), plus dans cette section.
export const row: Sx = {
  display: 'flex',
  gap: 3,
  flexDirection: 'column',
};

export const delegatesCol: Sx = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
};

export const colTitle: Sx = { fontWeight: 800, mb: 2 };

export const delegatesCard: Sx = { p: 2.5, position: 'relative', flex: 1 };

export const emptyState: Sx = { p: 4, textAlign: 'center' };

/** Colonnes par section — la liste empilée n'occupait que la moitié gauche de la carte. */
export const delegatesGrid: Sx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fit, minmax(220px, 1fr))' },
  gap: 2,
};

// Couleur stable par section (djb2 → petite palette lisible dark ET light) : liseré + nom +
// avatars — la carte grise uniforme ne différenciait pas les sections.
const SECTION_COLORS = {
  dark: ['#22c7e6', '#a78bfa', '#f272b6', '#34d399', '#fbbf24', '#7aa7ff'],
  light: ['#0090ad', '#6d3fd4', '#c2337f', '#0f8a5f', '#a16207', '#3565c9'],
} as const;

export function sectionColor(name: string, mode: 'dark' | 'light'): string {
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) >>> 0;
  const palette = SECTION_COLORS[mode];
  return palette[h % palette.length];
}

export const delegateBlock = (color: string): Sx => ({
  borderLeft: `3px solid ${color}`,
  pl: 1.5,
});

export const delegateSectionName = (color: string): Sx => ({ mb: 1, fontWeight: 700, color });

export const delegateMembers: Sx = {
  display: 'flex',
  gap: 1,
  flexWrap: 'wrap',
};

export const delegateChip: Sx = {
  cursor: 'pointer',
  '&:focus-visible': {
    outline: (t) => `2px solid ${t.palette.primary.main}`,
    outlineOffset: 2,
  },
};

export const discordPopup: CSSProperties = {
  position: 'absolute',
  bottom: 12,
  right: 12,
  zIndex: 10,
};

export const discordBox: Sx = {
  bgcolor: TOKENS.brands.discord,
  color: '#fff',
  px: 2,
  py: 1,
  borderRadius: 2,
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  boxShadow: `0 4px 20px ${TOKENS.brands.discordShadow}`,
};

export const discordName: Sx = { fontWeight: 600 };

export const discordHandle: Sx = { opacity: 0.8 };

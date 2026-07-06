import type { SxProps, Theme } from '@mui/material';
import { TOKENS } from '@/theme/tokens';

type Sx = SxProps<Theme>;

// Liseré gauche à la couleur de la catégorie : différenciation immédiate au scan de la grille
// (remplace l'icône PDF rouge identique sur toutes les cartes).
export const card = (haloStrength: number, categoryColor: string): Sx => ({
  display: 'block',
  textDecoration: 'none',
  height: '100%',
  borderLeft: `3px solid ${categoryColor}`,
  // Halo proportional to popularity — caps at 1.0
  // At strength 0: no extra shadow. At strength 1: strong cyan glow.
  boxShadow:
    haloStrength > 0
      ? `0 0 ${16 + haloStrength * 24}px rgba(0,210,255,${0.1 + haloStrength * 0.25})`
      : undefined,
});

export const content: Sx = {
  p: 2,
  '&:last-child': { pb: 2 },
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  height: '100%',
};

// Ligne 1 : le titre (élément scanné en premier), badge Nouveau/🔥 juste après.
export const titleRow: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.75,
  minWidth: 0,
};

export const title: Sx = { fontWeight: 700, lineHeight: 1.3, minWidth: 0 };

// Ligne 2 : chip catégorie + cours · section, année reléguée en bout de ligne (elle passait
// AVANT le titre dans la v2 — hiérarchie inversée).
export const metaLine: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.75,
  minWidth: 0,
};

export const categoryChip = (color: string): Sx => ({
  bgcolor: `${color}15`,
  color,
  fontWeight: 600,
  fontSize: 10,
  height: 22,
  flexShrink: 0,
});

export const courseLine: Sx = { minWidth: 0 };

export const yearCaption: Sx = { fontSize: 11, whiteSpace: 'nowrap', ml: 'auto' };

export const freshnessChip: Sx = {
  height: 20,
  fontSize: 10,
  fontWeight: 700,
  flexShrink: 0,
};

export const ratingBox: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.4,
  color: TOKENS.rating.main,
};

export const ratingIcon: Sx = { fontSize: 15 };

export const ratingCountCaption: Sx = { color: 'text.secondary', fontSize: 11 };

export const viewsBox: Sx = { display: 'flex', alignItems: 'center', gap: 0.5 };

// Chips d'état, rares (En attente / IA) — la plupart des cartes n'en ont aucune.
export const stateRow: Sx = { display: 'flex', gap: 0.5, flexWrap: 'wrap' };

export const badgeChip: Sx = { fontSize: 10, height: 22, flexShrink: 0 };

export const badgeIcon: Sx = { fontSize: '14px !important' };

// Footer : avatar 20 px + auteur + date relative | note (si votée) + vues.
// (Le bouton Partager a été retiré : on ne partage pas un doc qu'on n'a pas encore ouvert.)
export const footerRow: Sx = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 1,
  mt: 'auto',
};

export const authorRow: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.75,
  minWidth: 0,
};

export const authorName: Sx = { fontSize: 11, fontWeight: 600 };

export const relativeDate: Sx = { fontSize: 11, whiteSpace: 'nowrap' };

export const metaRow: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  flexShrink: 0,
};

export const downloadsIcon: Sx = { fontSize: 14, color: 'text.secondary' };

// ——— Variante « row » (vue liste de l'explorer) : 2 lignes à gauche, stats à droite. ———

export const rowCard = (categoryColor: string): Sx => ({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  textDecoration: 'none',
  borderLeft: `3px solid ${categoryColor}`,
  px: 2,
  py: 1.25,
});

export const rowMain: Sx = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 0.5,
};

export const rowStats: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  flexShrink: 0,
};

// L'auteur disparaît sous md pour que la ligne reste lisible sur petit écran.
export const rowAuthor: Sx = {
  display: { xs: 'none', md: 'flex' },
  minWidth: 0,
  maxWidth: 200,
};

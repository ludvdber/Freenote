import type { SxProps, Theme } from '@mui/material';
import { TOKENS } from '@/theme/tokens';

type Sx = SxProps<Theme>;

// Carte v4 (maquette 6 validée) : la COUVERTURE porte l'identité couleur de la catégorie
// (le liseré gauche de la v3 devenait redondant — il ne survit qu'en variante « row »).
export const card = (haloStrength: number): Sx => ({
  display: 'flex',
  flexDirection: 'column',
  textDecoration: 'none',
  height: '100%',
  overflow: 'hidden',
  // Halo proportional to popularity — caps at 1.0
  // At strength 0: no extra shadow. At strength 1: strong cyan glow.
  boxShadow:
    haloStrength > 0
      ? `0 0 ${16 + haloStrength * 24}px rgba(0,210,255,${0.1 + haloStrength * 0.25})`
      : undefined,
  '&:hover .doc-cover-bg': { transform: 'scale(1.07)' },
  '&:hover .doc-title': { color: 'primary.main' },
});

export const content: Sx = {
  p: 2,
  pt: 1.5,
  '&:last-child': { pb: 2 },
  display: 'flex',
  flexDirection: 'column',
  gap: 0.5,
  flex: 1,
};

// ——— Couverture : ratio UNIFORME (hauteurs de grille égales), gradient catégorie, émoji
// filigrane, scrim bas pour la lisibilité du chip quelle que soit la teinte. ———
export const cover: Sx = {
  position: 'relative',
  aspectRatio: '21 / 6',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'flex-end',
  px: 1.5,
  py: 1.25,
  flexShrink: 0,
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, transparent 45%, rgba(10,10,26,0.45))',
  },
};

// Gradients semi-transparents : profonds sur le navy (dark), pastels sur le blanc (light) —
// les deux thèmes sont couverts sans variantes dédiées.
const COVER_GRADIENTS: Record<string, string> = {
  SYNTHESE: 'linear-gradient(130deg, rgba(0,210,255,0.32), rgba(0,80,125,0.42))',
  EXAMEN: 'linear-gradient(130deg, rgba(255,90,120,0.30), rgba(110,18,55,0.45))',
  NOTES: 'linear-gradient(130deg, rgba(255,217,61,0.26), rgba(120,82,8,0.42))',
  EXERCICES: 'linear-gradient(130deg, rgba(74,222,128,0.26), rgba(12,82,45,0.45))',
  COURS: 'linear-gradient(130deg, rgba(96,165,250,0.30), rgba(18,55,120,0.45))',
  TFE: 'linear-gradient(130deg, rgba(249,115,22,0.28), rgba(120,50,8,0.45))',
  DIVERS: 'linear-gradient(130deg, rgba(177,140,255,0.28), rgba(62,35,120,0.45))',
};

/**
 * `hueShift` (degrés, optionnel) : nuance déterministe DANS la famille de couleur de la catégorie.
 * Utilisé par la vitrine anonyme, où 2 catégories publiques seulement rendaient la grille monotone
 * (8 couvertures jaunes identiques) — la teinte reste reconnaissable, la répétition disparaît.
 */
export const coverBg = (category: string, hueShift = 0): Sx => ({
  position: 'absolute',
  inset: 0,
  background: COVER_GRADIENTS[category] ?? COVER_GRADIENTS.DIVERS,
  ...(hueShift !== 0 ? { filter: `hue-rotate(${hueShift}deg)` } : {}),
  transition: 'transform 0.35s ease-out',
});

export const coverEmoji: Sx = {
  position: 'absolute',
  right: 8,
  top: '50%',
  transform: 'translateY(-52%) rotate(-8deg)',
  fontSize: 64,
  lineHeight: 1,
  opacity: 0.5,
  userSelect: 'none',
  filter: 'saturate(0.9)',
};

// Chip catégorie posé sur le scrim : fond navy propre → on garde la couleur DARK de la
// catégorie quel que soit le thème (toujours lisible sur ce fond).
export const coverCatChip = (colorDark: string): Sx => ({
  position: 'relative',
  zIndex: 1,
  height: 20,
  fontSize: 10,
  fontWeight: 800,
  color: colorDark,
  bgcolor: 'rgba(10,10,26,0.6)',
  backdropFilter: 'blur(6px)',
});

export const coverFresh: Sx = {
  position: 'absolute',
  zIndex: 1,
  top: 8,
  left: 12,
  height: 20,
  fontSize: 10,
  fontWeight: 800,
};

export const coverHot: Sx = {
  position: 'absolute',
  zIndex: 1,
  top: 6,
  left: 12,
  fontSize: 15,
  lineHeight: 1,
  cursor: 'default',
};

// Ligne 1 : le titre (élément scanné en premier), badge Nouveau/🔥 juste après.
export const titleRow: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.75,
  minWidth: 0,
};

export const title: Sx = { fontWeight: 700, lineHeight: 1.3, minWidth: 0 };

// Grille v4 : titre clampé à 2 lignes, hauteur NON réservée — la ligne cours · section reste
// COLLÉE dessous (demande explicite), le mou est absorbé avant le footer (mt: auto).
export const titleClamp: Sx = {
  fontWeight: 700,
  lineHeight: 1.35,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  transition: 'color 0.15s',
};

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

// Grille : année alignée à droite de la ligne méta. Liste : inline juste après cours · section
// (alignée à droite elle flottait au milieu de la rangée).
export const yearCaption: Sx = { fontSize: 11, whiteSpace: 'nowrap', ml: 'auto' };

export const yearInline: Sx = { fontSize: 11, whiteSpace: 'nowrap' };

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

// Footer grille v4 : avatar + prénom · date relative à gauche (revirement assumé 2026-07-07 —
// l'espace récupéré par la v4 le permet), note (si votée) + vues à droite.
export const footerRow: Sx = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 1,
  mt: 'auto',
  pt: 1,
};

export const whoBox: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.75,
  minWidth: 0,
};

export const whoText: Sx = {
  fontSize: 11,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

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

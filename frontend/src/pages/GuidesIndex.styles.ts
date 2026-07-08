import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

// ——— Refonte « Bibliothèque » (maquette A validée 2026-07-07) : couvertures gradient +
// émoji filigrane dérivés de la catégorie libre (lib/guideCover), chips catégories avec
// compteurs, carte « à la une » pour le guide le plus récent. Même grammaire de cartes
// que l'explorer (DocumentCard v4). ———

export const wrap: Sx = { maxWidth: 1100, mx: 'auto' };

export const eyebrow: Sx = {
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: 12,
  letterSpacing: 3,
  color: 'primary.main',
  textTransform: 'uppercase',
  mb: 1,
};

export const heroTitle: Sx = {
  fontWeight: 900,
  fontSize: { xs: '2rem', md: '2.6rem' },
  letterSpacing: '-0.02em',
  lineHeight: 1.12,
};

export const heroGradient: Sx = {
  background: 'linear-gradient(90deg, #7b2ff7, #00d2ff)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

export const intro: Sx = { color: 'text.secondary', maxWidth: 640, mt: 1.5, mb: 3.5, fontSize: '1.05rem' };

// Chips catégories avec compteurs — même patron que les quickCats de l'explorer.
export const cats: Sx = { display: 'flex', flexWrap: 'wrap', gap: 1, mb: 4 };

export const catChip = (active: boolean, color: string): Sx => ({
  fontWeight: 700,
  ...(active
    ? {
        bgcolor: `${color}1f`,
        borderColor: `${color}80`,
        color,
        // MUI Chip clickable : fixer le hover sinon il repasse au gris du thème.
        '&:hover': { bgcolor: `${color}2e` },
      }
    : {}),
});

// ——— Carte à la une (guide le plus récent, hors filtre) ———

export const featured: Sx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: '42% 1fr' },
  overflow: 'hidden',
  textDecoration: 'none',
  color: 'inherit',
  mb: 4,
  '&:hover .guide-cover-bg': { transform: 'scale(1.06)' },
  '&:hover .guide-title': { color: 'primary.main' },
};

export const featuredCover: Sx = {
  position: 'relative',
  minHeight: { xs: 150, md: 230 },
  overflow: 'hidden',
};

export const featuredEmoji: Sx = {
  position: 'absolute',
  right: 18,
  bottom: -14,
  fontSize: 110,
  lineHeight: 1,
  opacity: 0.45,
  transform: 'rotate(-8deg)',
  userSelect: 'none',
};

export const featuredNew: Sx = {
  position: 'absolute',
  top: 14,
  left: 14,
  height: 22,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 1,
};

/** Cadenas d'un guide réservé aux étudiants (V14), posé en haut-droite de la couverture. */
export const lockChip: Sx = {
  position: 'absolute',
  top: 10,
  right: 10,
  height: 22,
  fontSize: 12,
  bgcolor: 'rgba(10,10,26,0.55)',
  backdropFilter: 'blur(4px)',
  border: '1px solid rgba(255,217,61,0.35)',
};

export const featuredBody: Sx = {
  p: { xs: 2.5, md: 4 },
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 1.25,
};

export const featuredMeta: Sx = { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.25 };

export const featuredTitle: Sx = {
  fontWeight: 800,
  fontSize: { xs: '1.35rem', md: '1.7rem' },
  lineHeight: 1.25,
  transition: 'color 0.15s',
};

export const featuredSummary: Sx = { color: 'text.secondary', lineHeight: 1.55, flex: 1 };

export const readCta: Sx = { color: 'primary.main', fontWeight: 800, fontSize: '0.95rem' };

// ——— Cartes de la grille ———

export const card: Sx = {
  display: 'flex',
  flexDirection: 'column',
  textDecoration: 'none',
  color: 'inherit',
  height: '100%',
  overflow: 'hidden',
  '&:hover .guide-cover-bg': { transform: 'scale(1.07)' },
  '&:hover .guide-title': { color: 'primary.main' },
};

export const cover: Sx = {
  position: 'relative',
  aspectRatio: '21 / 8',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'flex-end',
  px: 1.75,
  py: 1.25,
  flexShrink: 0,
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, transparent 45%, rgba(10,10,26,0.5))',
  },
};

export const coverBg = (gradient: string): Sx => ({
  position: 'absolute',
  inset: 0,
  background: gradient,
  transition: 'transform 0.35s ease-out',
});

export const coverEmoji: Sx = {
  position: 'absolute',
  right: 10,
  top: '50%',
  transform: 'translateY(-52%) rotate(-8deg)',
  fontSize: 56,
  lineHeight: 1,
  opacity: 0.5,
  userSelect: 'none',
};

// Chip posé sur le scrim navy → couleur d'accent dark quel que soit le thème.
export const coverChip = (color: string): Sx => ({
  position: 'relative',
  zIndex: 1,
  height: 20,
  fontSize: 10,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color,
  bgcolor: 'rgba(10,10,26,0.6)',
  backdropFilter: 'blur(6px)',
});

export const body: Sx = {
  p: 2,
  pt: 1.5,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 0.75,
  flex: 1,
};

export const cardTitle: Sx = {
  fontWeight: 800,
  fontSize: '1.02rem',
  lineHeight: 1.3,
  transition: 'color 0.15s',
};

export const cardSummary: Sx = {
  color: 'text.secondary',
  fontSize: '0.87rem',
  lineHeight: 1.45,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

// Pill « outil lié » — rendu uniquement quand l'admin a lié un outil au guide.
export const toolPill: Sx = {
  height: 24,
  fontSize: 11.5,
  fontWeight: 700,
  color: 'primary.main',
  border: '1px solid rgba(0,210,255,0.35)',
  bgcolor: 'rgba(0,210,255,0.07)',
};

export const cardFooter: Sx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1,
  width: '100%',
  mt: 'auto',
  pt: 1,
};

export const cardTime: Sx = { fontSize: 11.5, color: 'text.secondary' };

export const cardGo: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  color: 'primary.main',
  fontWeight: 800,
  fontSize: '0.85rem',
};

export const adRow: Sx = { mt: 5, display: 'flex', justifyContent: 'center' };

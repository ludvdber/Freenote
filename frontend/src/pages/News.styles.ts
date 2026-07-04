import type { SxProps, Theme } from '@mui/material';
import { TOKENS } from '@/theme/tokens';

type Sx = SxProps<Theme>;

export const title: Sx = { fontWeight: 800, mb: 0.5 };

export const subtitle: Sx = { color: 'text.secondary', mb: 4, maxWidth: 680 };

/* ---- Hero (latest post) ------------------------------------------------- */

export const hero: Sx = {
  p: 0,
  overflow: 'hidden',
  display: { xs: 'block', md: 'grid' },
  gridTemplateColumns: { md: '1.15fr 1fr' },
  textDecoration: 'none',
  color: 'inherit',
  mb: 4,
  '&:hover .news-media img': { transform: 'scale(1.04)' },
};

export const heroMedia: Sx = {
  position: 'relative',
  overflow: 'hidden',
  minHeight: { xs: 200, sm: 280, md: '100%' },
  aspectRatio: { xs: '16 / 9', md: 'auto' },
};

export const heroBody: Sx = {
  p: { xs: 2.5, md: 4 },
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 1.5,
};

export const heroEyebrow: Sx = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 1,
};

export const heroTitle: Sx = {
  fontWeight: 800,
  fontSize: { xs: '1.5rem', md: '2rem' },
  lineHeight: 1.15,
  letterSpacing: '-0.02em',
};

export const heroExcerpt: Sx = {
  color: 'text.secondary',
  lineHeight: 1.6,
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

export const heroCta: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  color: 'primary.main',
  fontWeight: 700,
  fontSize: '0.9rem',
  mt: 0.5,
};

export const accentBar: Sx = {
  width: 56,
  height: 4,
  borderRadius: 2,
  background: TOKENS.gradients.primaryBar,
};

/* ---- Card grid (remaining posts) ---------------------------------------- */

export const sectionLabel: Sx = {
  fontWeight: 700,
  fontSize: '0.8rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'text.disabled',
  mb: 2,
};

export const grid: Sx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
  gap: 3,
};

export const card: Sx = {
  p: 0,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  textDecoration: 'none',
  color: 'inherit',
  height: '100%',
  '&:hover .news-media img': { transform: 'scale(1.05)' },
};

export const cardMedia: Sx = {
  position: 'relative',
  overflow: 'hidden',
  aspectRatio: '16 / 9',
};

export const cardBody: Sx = {
  p: 2,
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  flexGrow: 1,
};

export const cardTitle: Sx = {
  fontWeight: 700,
  fontSize: '1.02rem',
  lineHeight: 1.3,
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

/* ---- Shared media bits -------------------------------------------------- */

export const img: Sx = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
  transition: 'transform 0.4s ease',
};

// On-brand gradient variants for the imageless-post fallback tile, so a grid with no
// thumbnails doesn't read as a wall of identical boxes. Picked deterministically per post.
const PLACEHOLDER_GRADIENTS = [
  'linear-gradient(135deg, rgba(0,210,255,0.18), rgba(123,47,247,0.16))',
  'linear-gradient(135deg, rgba(123,47,247,0.18), rgba(255,107,157,0.14))',
  'linear-gradient(135deg, rgba(16,185,129,0.16), rgba(0,210,255,0.16))',
  'linear-gradient(135deg, rgba(251,191,36,0.14), rgba(255,107,157,0.16))',
];

// Gradient "cover" tile when a post has no image: brand mark watermark + the section label,
// so an imageless card still reads as an intentional magazine cover. `seed` = deterministic variant.
export const placeholder = (seed: number): Sx => ({
  position: 'relative',
  overflow: 'hidden',
  width: '100%',
  height: '100%',
  minHeight: 160,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  p: 2,
  background: PLACEHOLDER_GRADIENTS[Math.abs(seed) % PLACEHOLDER_GRADIENTS.length],
});

// Faint brand mark, oversized in the corner as a watermark.
export const placeholderMark: Sx = {
  position: 'absolute',
  right: -14,
  bottom: -18,
  opacity: 0.16,
  transform: 'rotate(-8deg)',
  pointerEvents: 'none',
  lineHeight: 0,
};

// The section label as the cover's focal text (falls back to a wordmark when unlabelled).
export const placeholderLabel: Sx = {
  position: 'relative',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  textAlign: 'center',
  lineHeight: 1.15,
  color: 'rgba(255,255,255,0.82)',
  fontSize: { xs: '1.1rem', md: '1.35rem' },
  textShadow: '0 2px 12px rgba(0,0,0,0.25)',
};

export const eyebrow: Sx = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 0.75,
};

export const chip: Sx = {
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontSize: '0.64rem',
  height: 20,
  color: 'primary.main',
  borderColor: 'rgba(0, 210, 255, 0.4)',
  backgroundColor: 'rgba(0, 210, 255, 0.06)',
};

export const meta: Sx = { color: 'text.secondary', fontWeight: 600, fontSize: '0.8rem' };

export const dot: Sx = {
  width: 3,
  height: 3,
  borderRadius: '50%',
  bgcolor: 'text.disabled',
  flexShrink: 0,
};

export const emptyCard: Sx = { p: 4, textAlign: 'center', color: 'text.secondary' };

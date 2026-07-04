import type { SxProps, Theme } from '@mui/material';
import type { ToolSize } from './toolsData';

type Sx = SxProps<Theme>;

export const container: Sx = {
  py: 4,
  minHeight: 'calc(100vh - 200px)',
};

export const title: Sx = {
  fontWeight: 800,
  mb: 1,
  background: 'linear-gradient(135deg, #00d2ff, #7b2ff7)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

export const subtitle: Sx = {
  mb: 3,
  color: 'text.secondary',
  maxWidth: 720,
};

/* ---- Category filter ---------------------------------------------------- */

export const filterRow: Sx = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 1,
  mb: 3,
};

export const filterChip = (active: boolean): Sx => ({
  fontWeight: 700,
  px: 0.5,
  borderRadius: 2,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  border: '1px solid',
  ...(active
    ? {
        color: '#fff',
        borderColor: 'transparent',
        background: 'linear-gradient(135deg, #00d2ff, #7b2ff7)',
      }
    : {
        color: 'text.secondary',
        borderColor: (t: Theme) =>
          t.palette.mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)',
        backgroundColor: 'transparent',
        '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
      }),
});

/* ---- Bento grid --------------------------------------------------------- */

export const bento: Sx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
  gridAutoRows: { xs: 'auto', md: '182px' },
  gridAutoFlow: 'dense',
  gap: { xs: 2, md: 2.5 },
};

export const tile = (size: ToolSize): Sx => ({
  p: { xs: 2.25, md: 2.5 },
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 0.75,
  textDecoration: 'none',
  color: 'inherit',
  position: 'relative',
  overflow: 'hidden',
  cursor: 'pointer',
  transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    borderColor: 'primary.main',
    boxShadow: '0 12px 40px rgba(0,210,255,0.12)',
  },
  '&:hover .tool-preview': { opacity: 1 },
  ...(size === 'lg' && {
    gridColumn: { sm: 'span 2' },
    gridRow: { md: 'span 2' },
    minHeight: { xs: 300, md: 'auto' },
  }),
  ...(size === 'wide' && {
    gridColumn: { sm: 'span 2' },
    minHeight: { xs: 150, md: 'auto' },
  }),
  ...(size === 'sm' && { minHeight: { xs: 150, md: 'auto' } }),
});

export const tileHead: Sx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

export const tileIcon = (size: ToolSize): Sx => ({
  width: size === 'lg' ? 52 : 44,
  height: size === 'lg' ? 52 : 44,
  borderRadius: 2,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, rgba(0,210,255,0.18), rgba(123,47,247,0.18))',
  color: 'primary.main',
  flexShrink: 0,
  '& svg': { fontSize: size === 'lg' ? 30 : 24 },
});

export const tileBadge: Sx = {
  fontSize: '0.66rem',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'primary.main',
  px: 1,
  py: 0.25,
  borderRadius: 1,
  border: '1px solid rgba(0,210,255,0.35)',
  backgroundColor: 'rgba(0,210,255,0.06)',
};

export const tileTitle = (size: ToolSize): Sx => ({
  fontWeight: 700,
  fontSize: size === 'lg' ? '1.25rem' : '1.02rem',
  lineHeight: 1.2,
  mt: size === 'lg' ? 0.5 : 0.25,
});

export const tileDesc = (size: ToolSize): Sx => ({
  color: 'text.secondary',
  fontSize: size === 'lg' ? '0.9rem' : '0.82rem',
  lineHeight: 1.45,
  flexGrow: size === 'lg' ? 0 : 1,
  display: '-webkit-box',
  WebkitLineClamp: size === 'lg' ? 3 : 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

// Decorative live preview area on the two flagship tiles — grows to fill the tall tile.
export const previewWrap: Sx = {
  flexGrow: 1,
  minHeight: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  my: 1,
  opacity: 0.92,
  transition: 'opacity 0.2s ease',
};

export const tileCta: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  color: 'primary.main',
  fontWeight: 600,
  fontSize: '0.85rem',
  mt: 'auto',
};

/* ---- Flashcards flip preview -------------------------------------------- */

export const flipScene: Sx = {
  width: '100%',
  maxWidth: 240,
  height: 96,
  perspective: '800px',
};

export const flipCard: Sx = {
  position: 'relative',
  width: '100%',
  height: '100%',
  transformStyle: 'preserve-3d',
  animation: 'toolFlip 6s ease-in-out infinite',
  '@keyframes toolFlip': {
    '0%, 40%': { transform: 'rotateY(0deg)' },
    '55%, 90%': { transform: 'rotateY(180deg)' },
    '100%': { transform: 'rotateY(360deg)' },
  },
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
};

const flipFaceBase: Sx = {
  position: 'absolute',
  inset: 0,
  borderRadius: 2,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0.5,
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
  border: '1px solid rgba(0,210,255,0.25)',
  fontWeight: 700,
};

export const flipFront: Sx = {
  ...flipFaceBase,
  background: 'linear-gradient(135deg, rgba(0,210,255,0.14), rgba(123,47,247,0.1))',
  color: 'text.primary',
};

export const flipBack: Sx = {
  ...flipFaceBase,
  transform: 'rotateY(180deg)',
  background: 'linear-gradient(135deg, rgba(123,47,247,0.16), rgba(0,210,255,0.1))',
  color: 'primary.main',
};

export const flipHint: Sx = {
  fontSize: '0.62rem',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'text.disabled',
};

/* ---- Quiz preview ------------------------------------------------------- */

export const quizPreview: Sx = {
  width: '100%',
  maxWidth: 260,
  display: 'flex',
  flexDirection: 'column',
  gap: 0.6,
};

export const quizQuestion: Sx = {
  fontSize: '0.78rem',
  fontWeight: 700,
  mb: 0.25,
  color: 'text.primary',
};

export const quizOption = (correct: boolean): Sx => ({
  fontSize: '0.72rem',
  fontWeight: 600,
  px: 1,
  py: 0.6,
  borderRadius: 1.5,
  border: '1px solid',
  borderColor: (t: Theme) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
  color: 'text.secondary',
  ...(correct && {
    animation: 'toolQuizPulse 4s ease-in-out infinite',
    '@keyframes toolQuizPulse': {
      '0%, 45%, 100%': {
        borderColor: (t: Theme) =>
          t.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        color: 'text.secondary',
        backgroundColor: 'transparent',
      },
      '60%, 85%': {
        borderColor: 'rgba(16,185,129,0.6)',
        color: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.1)',
      },
    },
    '@media (prefers-reduced-motion: reduce)': {
      animation: 'none',
      borderColor: 'rgba(16,185,129,0.6)',
      color: '#10b981',
      backgroundColor: 'rgba(16,185,129,0.1)',
    },
  }),
});

/* ---- SEO prose ---------------------------------------------------------- */

export const sectionHeading: Sx = {
  fontWeight: 700,
  mt: 5,
  mb: 1.5,
};

export const paragraph: Sx = {
  mb: 1.5,
  color: 'text.secondary',
  lineHeight: 1.7,
  maxWidth: 760,
};

import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

export const staggerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15 } },
};

export const fadeUpVariants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

// The hero <h1> is the LCP element. Keep it painted from the first frame (no opacity:0 start)
// so Lighthouse measures LCP immediately instead of waiting for the fade — only the upward
// slide is animated, which doesn't affect when the text is considered "painted".
export const titleVariants = {
  hidden: { y: 30 },
  show: { y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

export const heroContainer: Sx = {
  position: 'relative',
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  overflow: 'hidden',
};

export const scrollIndicator: Sx = {
  position: 'absolute',
  bottom: { xs: 60, md: 80 },
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 0.5,
  color: 'text.secondary',
  cursor: 'pointer',
  zIndex: 2,
  userSelect: 'none',
  background: 'none',
  border: 'none',
  padding: 0,
  fontFamily: 'inherit',
  '&:hover': { color: 'primary.main' },
};

export const scrollIndicatorLabel: Sx = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: 'uppercase',
  opacity: 0.8,
};

export const inner: Sx = {
  position: 'relative',
  zIndex: 1,
  textAlign: 'center',
};

export const title: Sx = {
  fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' },
  fontWeight: 900,
  lineHeight: 1.06,
  letterSpacing: -2,
  mb: 2.5,
};

export const titleGradient: Sx = {
  background: 'linear-gradient(135deg, #00d2ff, #7b2ff7)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

export const subtitle: Sx = {
  mb: 0,
  fontWeight: 400,
  fontSize: { xs: '1rem', md: '1.15rem' },
  maxWidth: 560,
  mx: 'auto',
  lineHeight: 1.7,
};

export const restrictedBadge: Sx = {
  display: 'inline-block',
  mt: 3,
  mb: 4,
  letterSpacing: 0.5,
  fontWeight: 600,
  fontSize: 13,
  px: 2,
  py: 0.5,
  borderRadius: 2,
  bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(0,210,255,0.08)' : 'rgba(0,210,255,0.12)',
  border: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(0,210,255,0.2)' : 'rgba(0,210,255,0.3)'}`,
  color: 'primary.main',
};

export const ctaRow: Sx = {
  display: 'flex',
  gap: 2,
  justifyContent: 'center',
  flexWrap: 'wrap',
};

export const ctaPrimary: Sx = {
  px: 4,
  py: 1.5,
  fontSize: '1rem',
  background: 'linear-gradient(135deg, #00d2ff, #7b2ff7)',
  boxShadow: '0 4px 24px rgba(0,210,255,0.18)',
  '&:hover': {
    background: 'linear-gradient(135deg, #00b8d9, #6a1be0)',
  },
};

export const ctaSecondary: Sx = {
  px: 4,
  py: 1.5,
  fontSize: '1rem',
};

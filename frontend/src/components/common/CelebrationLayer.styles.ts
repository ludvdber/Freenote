import { keyframes } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material';
import { accentGradientAlpha } from '@/theme/accent';

type Sx = SxProps<Theme>;

// Styles des célébrations (maquette « Moments de lumière »). Doses courtes (≤ 1,2 s), jamais
// en boucle sauf l'étoile filante du toast (discrète) ; le kill-switch global
// prefers-reduced-motion de MuiCssBaseline neutralise toutes les animations.

const toastIn = keyframes`
  from { transform: translateY(18px); opacity: 0; }
  to { transform: none; opacity: 1; }
`;

const zip = keyframes`
  0% { transform: translate(0, 0) rotate(-24deg); opacity: 0; }
  12% { opacity: 1; }
  45% { transform: translate(64px, -26px) rotate(-24deg); opacity: 0; }
  100% { opacity: 0; }
`;

const pop = keyframes`
  from { transform: scale(0.4); opacity: 0; }
  to { transform: none; opacity: 1; }
`;

export const toast = (dark: boolean): Sx => ({
  position: 'relative',
  display: 'flex',
  gap: 1.75,
  alignItems: 'center',
  maxWidth: 430,
  borderRadius: '14px',
  p: '14px 18px',
  overflow: 'hidden',
  background: (t) => `${accentGradientAlpha(t, dark ? 0.13 : 0.09, 140)}, ${dark ? '#101828' : '#ffffff'}`,
  border: (t) => `1px solid ${alpha(t.palette.primary.main, dark ? 0.35 : 0.4)}`,
  boxShadow: (t) => dark
    ? `0 8px 32px rgba(0,0,0,0.5), 0 0 24px ${alpha(t.palette.primary.main, 0.12)}`
    : '0 8px 32px rgba(30,41,72,0.18)',
  animation: `${toastIn} 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both`,
});

export const toastIcon: Sx = {
  position: 'relative',
  width: 44,
  height: 44,
  flexShrink: 0,
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  background: (t) => `radial-gradient(circle at 35% 30%, ${alpha(t.palette.primary.main, 0.35)}, ${alpha(t.palette.secondary.main, 0.25)})`,
  fontSize: 21,
};

export const zipStar = (dark: boolean): Sx => ({
  position: 'absolute',
  left: -16,
  top: 4,
  width: 30,
  height: '1.6px',
  borderRadius: '2px',
  transform: 'rotate(-24deg)',
  background: dark
    ? 'linear-gradient(90deg, transparent, #bfeaff)'
    : 'linear-gradient(90deg, transparent, #3565c9)',
  animation: `${zip} 1.8s ease-out 0.3s infinite`,
  pointerEvents: 'none',
});

export const toastTitle: Sx = { fontWeight: 800, fontSize: 15, lineHeight: 1.3 };

export const toastSub: Sx = { fontSize: 13, color: 'text.secondary' };

export const xpChip: Sx = {
  ml: 'auto',
  flexShrink: 0,
  fontFamily: 'ui-monospace, monospace',
  fontWeight: 800,
  fontSize: 13,
  color: '#0a0e1a',
  bgcolor: '#ffd166',
  borderRadius: '99px',
  px: 1.5,
  py: 0.5,
  animation: `${pop} 0.45s cubic-bezier(0.2, 1.4, 0.4, 1) 0.25s both`,
};

// ── Modal de palier ──

const draw = keyframes`
  to { stroke-dashoffset: 0; }
`;

const starIn = keyframes`
  from { opacity: 0; transform: scale(0.3); }
  to { opacity: 1; transform: none; }
`;

export const levelCard = (dark: boolean): Sx => ({
  textAlign: 'center',
  p: '38px 30px 30px',
  background: (t) => `linear-gradient(180deg, ${alpha(t.palette.primary.main, dark ? 0.08 : 0.07)}, ${alpha(t.palette.secondary.main, dark ? 0.10 : 0.06)})`,
});

export const drawSvg: Sx = {
  width: 190,
  height: 110,
  display: 'block',
  mx: 'auto',
  mb: 0.75,
  '& line': {
    stroke: (t: Theme) => alpha(t.palette.primary.main, 0.6),
    strokeWidth: 1.2,
    strokeDasharray: 120,
    strokeDashoffset: 120,
    animation: `${draw} 1.2s ease-out forwards`,
  },
  '& line:nth-of-type(2)': { animationDelay: '0.35s' },
  '& line:nth-of-type(3)': { animationDelay: '0.7s' },
  '& circle': { opacity: 0, animation: `${starIn} 0.4s ease-out forwards` },
  '& circle:nth-of-type(1)': { animationDelay: '0.1s' },
  '& circle:nth-of-type(2)': { animationDelay: '0.45s' },
  '& circle:nth-of-type(3)': { animationDelay: '0.8s' },
  '& circle:nth-of-type(4)': { animationDelay: '1.15s' },
};

export const eyebrow: Sx = {
  fontFamily: 'ui-monospace, monospace',
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: 'primary.main',
};

export const levelName = (color: string, gradient?: string): Sx => ({
  fontWeight: 800,
  my: 0.5,
  ...(gradient
    ? {
        background: gradient,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }
    : { color }),
});

export const levelBody: Sx = { color: 'text.secondary', fontSize: 14, mb: 2.5 };

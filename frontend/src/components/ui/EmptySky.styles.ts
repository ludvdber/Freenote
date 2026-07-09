import { keyframes } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

// Visuels « ciel » des empty states (maquette « Poussière d'étoile » validée 2026-07-09).
// Décoratifs purs (aria-hidden), déclinés dark + light. Les animations sont neutralisées
// globalement par le kill-switch prefers-reduced-motion de MuiCssBaseline.

const shoot = keyframes`
  0% { transform: translate(0, 0) rotate(16deg); opacity: 0; }
  6% { opacity: 1; }
  26% { transform: translate(340px, 96px) rotate(16deg); opacity: 0; }
  100% { opacity: 0; }
`;

export const shootingStar = (dark: boolean): Sx => ({
  position: 'absolute',
  top: 18,
  left: -40,
  width: 74,
  height: '2px',
  borderRadius: '2px',
  background: dark
    ? 'linear-gradient(90deg, transparent, #bfeaff 60%, #fff)'
    : 'linear-gradient(90deg, transparent, rgba(53,101,201,0.7) 60%, #3565c9)',
  transform: 'rotate(16deg)',
  animation: `${shoot} 3.4s ease-in infinite`,
  pointerEvents: 'none',
  '&::after': {
    content: '""',
    position: 'absolute',
    right: -3,
    top: '-2.4px',
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: dark ? '#fff' : '#3565c9',
    boxShadow: dark ? '0 0 12px 3px rgba(160,225,255,0.9)' : '0 0 10px 2px rgba(53,101,201,0.6)',
  },
});

export const orbitRing = (dark: boolean): Sx => ({
  position: 'absolute',
  left: '50%',
  top: '56%',
  width: { xs: 130, md: 190 },
  height: { xs: 38, md: 54 },
  transform: 'translateX(-50%) rotate(-14deg)',
  borderRadius: '50%',
  border: `1.5px solid ${dark ? 'rgba(0,212,255,0.35)' : 'rgba(0,98,163,0.35)'}`,
  pointerEvents: 'none',
});

export const telescopeSky: Sx = { position: 'relative', height: 86, mb: 2 };

export const quadrantFrame = (dark: boolean): Sx => ({
  position: 'absolute',
  inset: 0,
  m: 'auto',
  width: 104,
  height: 74,
  border: `1.5px dashed ${dark ? 'rgba(148,161,181,0.4)' : 'rgba(30,41,72,0.3)'}`,
  borderRadius: '10px',
  '&::after': {
    content: '""',
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: '50%',
    left: '44%',
    top: '40%',
    background: dark ? 'rgba(148,161,181,0.35)' : 'rgba(30,41,72,0.25)',
  },
});

const zz = keyframes`
  0%, 100% { transform: translateY(0); opacity: 0.5; }
  50% { transform: translateY(-6px); opacity: 1; }
`;

export const moonSky: Sx = { position: 'relative', height: 72, mb: 1.5 };

export const moon = (dark: boolean): Sx => ({
  position: 'absolute',
  left: '50%',
  top: 6,
  ml: '-26px',
  width: 52,
  height: 52,
  borderRadius: '50%',
  background: dark
    ? 'radial-gradient(circle at 36% 32%, #223052, #101a30 68%)'
    : 'radial-gradient(circle at 36% 32%, #dbe6f5, #b9c8e0 68%)',
  boxShadow: dark
    ? 'inset -8px -6px 18px rgba(0,0,0,0.55), 0 0 24px rgba(0,212,255,0.12)'
    : 'inset -8px -6px 18px rgba(30,41,72,0.25), 0 0 24px rgba(0,98,163,0.10)',
});

export const moonZz: Sx = {
  position: 'absolute',
  left: 'calc(50% + 26px)',
  top: 0,
  fontFamily: 'ui-monospace, monospace',
  fontWeight: 800,
  fontSize: 15,
  color: 'text.secondary',
  animation: `${zz} 2.6s ease-in-out infinite`,
};

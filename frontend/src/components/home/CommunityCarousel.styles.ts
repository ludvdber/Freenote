import type { SxProps, Theme } from '@mui/material';
import type { CSSProperties } from 'react';
import { TOKENS } from '@/theme/tokens';

type Sx = SxProps<Theme>;

export const section: Sx = { py: { xs: 6, md: 9 }, position: 'relative' };

export const title: Sx = {
  textAlign: 'center',
  mb: 3,
  fontWeight: 800,
};

export const emptyCard: Sx = {
  p: 5,
  textAlign: 'center',
  maxWidth: 440,
  mx: 'auto',
};

export const emptyIcon: Sx = { fontSize: 40, mb: 1 };

export const emptyText: Sx = { fontWeight: 600 };

export const marqueeViewport: Sx = { overflow: 'hidden', position: 'relative' };

export const fadeEdgeLeft: Sx = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: 60,
  zIndex: 2,
  background: (t) =>
    `linear-gradient(90deg, ${t.palette.background.default}, transparent)`,
  pointerEvents: 'none',
};

export const fadeEdgeRight: Sx = {
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: 60,
  zIndex: 2,
  background: (t) =>
    `linear-gradient(270deg, ${t.palette.background.default}, transparent)`,
  pointerEvents: 'none',
};

export const marqueeTrack = (paused: boolean): Sx => ({
  display: 'flex',
  gap: 2,
  animation: 'marquee 40s linear infinite',
  animationPlayState: paused ? 'paused' : 'running',
  width: 'max-content',
  '&:hover': { animationPlayState: 'paused' },
  '@keyframes marquee': {
    '0%': { transform: 'translateX(0)' },
    '100%': { transform: 'translateX(-50%)' },
  },
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
  },
});

export const pauseButton: Sx = {
  position: 'absolute',
  top: 8,
  right: 8,
  zIndex: 3,
  bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)'),
  backdropFilter: 'blur(8px)',
  '&:hover': {
    bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)'),
  },
};

export const profileWrapper: Sx = {
  minWidth: 200,
  cursor: 'pointer',
  flexShrink: 0,
  borderRadius: 4,
  '&:focus-visible': {
    outline: (t) => `2px solid ${t.palette.primary.main}`,
    outlineOffset: 2,
  },
};

export const profileCard: Sx = {
  p: 2,
  textAlign: 'center',
  '&:hover': { borderColor: 'primary.main' },
};

export const profileAvatar: Sx = {
  mx: 'auto',
  mb: 1,
};

export const profileName: Sx = { fontWeight: 700 };

export const profileMeta: Sx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0.5,
  mt: 0.5,
};

export const discordPill: Sx = {
  bgcolor: TOKENS.brands.discord,
  color: 'common.white',
  fontSize: 10,
  px: 0.8,
  py: 0.2,
  borderRadius: 1,
  fontWeight: 600,
};

export const popupBackdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(10, 14, 26, 0.55)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  zIndex: 1299,
};

export const popupWrapper: CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 1300,
  width: 'min(360px, calc(100vw - 32px))',
};

export const popupCard: Sx = {
  p: 3,
  position: 'relative',
  boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
};

export const popupClose: Sx = {
  position: 'absolute',
  top: 8,
  right: 8,
};

// Colonne flex : chaque élément (nom, rôle, bouton profil, liens) occupe SA ligne — la caption
// du rôle est un <span> inline, sans ça elle partageait sa ligne avec le bouton « Voir le
// profil » (chevauchement vu en capture le 2026-07-08).
export const popupBody: Sx = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
};

export const popupAvatar: Sx = {
  mx: 'auto',
  mb: 1,
};

export const popupName: Sx = { fontWeight: 700 };

export const popupActions: Sx = {
  display: 'flex',
  gap: 1.5,
  justifyContent: 'center',
  mt: 2,
};

export const popupDiscordPill: Sx = {
  bgcolor: TOKENS.brands.discord,
  color: 'common.white',
  px: 2,
  py: 0.5,
  borderRadius: 2,
  fontSize: 13,
  fontWeight: 600,
};


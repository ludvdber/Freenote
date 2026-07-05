import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

export const footer: Sx = {
  py: 4,
  mt: 8,
  borderTop: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  background: (t) => t.palette.mode === 'dark' ? 'rgba(10, 14, 26, 0.5)' : 'rgba(0, 0, 0, 0.02)',
};

export const topGrid: Sx = { mb: 3 };

export const logo: Sx = {
  fontWeight: 800,
  color: 'primary.main',
  mb: 0.5,
};

export const tagline: Sx = { mb: 1 };

export const independent: Sx = { fontStyle: 'italic' };

export const colTitle: Sx = { fontWeight: 700, mb: 1.5 };

export const linksCol: Sx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0.5,
};

export const iconLink: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
};

export const iconSize: Sx = { fontSize: 16 };

export const bottomBorder: Sx = {
  borderTop: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)'}`,
  pt: 2,
};

export const copyright: Sx = { display: 'block', textAlign: 'center' };

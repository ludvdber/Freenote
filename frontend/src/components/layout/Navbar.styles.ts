import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

export const appBar: Sx = {
  background: (t) => t.palette.mode === 'dark'
    ? 'rgba(10, 14, 26, 0.8)'
    : 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(12px)',
  borderBottom: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
  boxShadow: 'none',
  color: 'text.primary',
};

export const toolbar: Sx = { justifyContent: 'space-between', gap: 1 };

export const logo: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  fontWeight: 800,
  color: 'text.primary',
  textDecoration: 'none',
};

export const logoGradient: Sx = {
  background: 'linear-gradient(135deg, #06b6d4, #a855f7)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

export const actionsRow: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
};

export const navButton = (active: boolean): Sx => ({
  fontWeight: active ? 800 : 600,
  color: active ? 'primary.main' : 'inherit',
  position: 'relative',
  '&::after': active
    ? {
        content: '""',
        position: 'absolute',
        bottom: 4,
        left: '25%',
        right: '25%',
        height: 2,
        borderRadius: 1,
        bgcolor: 'primary.main',
      }
    : undefined,
});

export const langToggle: Sx = {
  display: 'flex',
  borderRadius: 1,
  overflow: 'hidden',
  border: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
};

export const langOption = (active: boolean): Sx => ({
  all: 'unset',
  cursor: 'pointer',
  px: 0.8,
  py: 0.3,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.5,
  lineHeight: 1,
  transition: 'all 0.15s',
  bgcolor: active ? 'primary.main' : 'transparent',
  color: active ? '#fff' : 'text.secondary',
  '&:hover': active ? {} : { bgcolor: 'action.hover' },
});


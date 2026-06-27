import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

export const wrapper: Sx = {
  mb: 3,
  borderRadius: 3,
  overflow: 'hidden',
  border: (t) => (t.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.1)'),
  bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
};

export const toolbar: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  px: 1,
  py: 0.5,
  borderBottom: (t) => (t.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.1)'),
  position: 'sticky',
  top: 0,
  zIndex: 1,
  backdropFilter: 'blur(8px)',
};

export const canvasArea: Sx = {
  height: { xs: '70vh', md: '80vh' },
  overflow: 'auto',
  p: { xs: 1, sm: 2 },
};

export const center: Sx = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 300,
  textAlign: 'center',
};

export const pageLabel: Sx = { minWidth: 72, textAlign: 'center' };

export const zoomLabel: Sx = { minWidth: 48, textAlign: 'center' };

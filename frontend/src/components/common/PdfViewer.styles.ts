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
  height: { xs: '78vh', md: '85vh' },
  overflow: 'auto',
  overscrollBehavior: 'contain',
  p: { xs: 1, sm: 2 },
};

// Vertical stack of pages. `fit-content` + `minWidth 100%` lets a zoomed page (wider than the
// viewport) push the column wider so the container scrolls horizontally, while narrower pages stay
// centered.
export const pagesCol: Sx = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: { xs: 1.5, sm: 2 },
  width: 'fit-content',
  minWidth: '100%',
  mx: 'auto',
};

// A single page — reads like paper: white sheet + soft shadow. minHeight is set inline (placeholder)
// so the page reserves its space before it lazily renders.
export const pageBox: Sx = {
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
  backgroundColor: '#fff',
  borderRadius: 1,
  overflow: 'hidden',
  boxShadow: (t) =>
    t.palette.mode === 'dark' ? '0 2px 14px rgba(0,0,0,0.5)' : '0 2px 12px rgba(0,0,0,0.14)',
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

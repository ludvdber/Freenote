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
  flexWrap: 'wrap', // la zone de recherche passe à la ligne sur mobile plutôt que d'écraser le zoom
  gap: 0.5,
  px: 1,
  py: 0.5,
  borderBottom: (t) => (t.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.1)'),
  position: 'sticky',
  top: 0,
  zIndex: 1,
  backdropFilter: 'blur(8px)',
};

// Zone « Rechercher dans le PDF » de la barre d'outils — visible (pas seulement Ctrl+F).
export const searchBox: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  px: 1,
  py: 0.25,
  borderRadius: 2,
  minWidth: 160,
  flex: '0 1 260px',
  border: (t) => (t.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.15)'),
  bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
};

export const searchInput: Sx = {
  fontSize: 13,
  flex: 1,
  minWidth: 0,
};

// Hauteur passée par le composant = une page entière au fit-width (fallback vh avant mesure).
export const canvasArea = (height?: number): Sx => ({
  height: height ?? { xs: '78vh', md: '85vh' },
  overflow: 'auto',
  overscrollBehavior: 'contain',
  p: { xs: 1, sm: 2 },
});

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

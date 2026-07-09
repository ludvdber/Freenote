import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

export const title: Sx = { fontWeight: 700, mb: 3 };

export const errorAlert: Sx = { mb: 2 };

// Formulaire + rail « Ce que ça rapporte » : la page n'annonçait nulle part la récompense XP
// (LA carotte du système) ni les attentes de qualité.
export const layout: Sx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 300px' },
  gap: { xs: 3, md: 4 },
  alignItems: 'start',
};

export const asideCard: Sx = {
  p: 2.5,
  position: { md: 'sticky' },
  top: { md: 88 },
};

export const asideTitle: Sx = { fontWeight: 800, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 };

export const asideList: Sx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  m: 0,
  p: 0,
  listStyle: 'none',
  '& li': { display: 'flex', gap: 1, alignItems: 'baseline', fontSize: '0.875rem' },
};

export const form: Sx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

export const dropzone = (active: boolean, hasFile: boolean): Sx => ({
  position: 'relative',
  border: (t) =>
    active
      ? `2px dashed ${t.palette.primary.main}`
      : hasFile
        ? `2px solid ${t.palette.primary.main}`
        : t.palette.mode === 'dark'
          ? '2px dashed rgba(255,255,255,0.2)'
          : '2px dashed rgba(0,0,0,0.2)',
  borderRadius: 3,
  p: 3,
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'border-color 0.2s, background-color 0.2s, transform 0.2s',
  bgcolor: active ? 'rgba(0,210,255,0.06)' : 'transparent',
  transform: active ? 'scale(1.01)' : 'none',
  '&:hover': {
    borderColor: (t) => t.palette.primary.main,
  },
  '&:focus-visible': {
    outline: (t) => `2px solid ${t.palette.primary.main}`,
    outlineOffset: 2,
  },
});

export const dropzoneIcon: Sx = {
  fontSize: 48,
  color: 'primary.main',
  mb: 1,
};

export const dropzoneText: Sx = { fontWeight: 700, mb: 0.5 };

export const dropzoneHint: Sx = { color: 'text.secondary', fontSize: 12 };

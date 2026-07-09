import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

// Panneau de notifications (maquette « Moments de lumière ») : header + lignes typées
// (icône, non-lu au liseré cyan, heure relative), état vide = lune endormie (EmptySky).

export const panel: Sx = { width: 380, maxWidth: '90vw' };

export const header: Sx = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  px: 2,
  py: 1.5,
  borderBottom: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
  fontWeight: 800,
  fontSize: 14.5,
};

export const list: Sx = { maxHeight: 400, overflowY: 'auto' };

export const row = (unread: boolean): Sx => ({
  display: 'flex',
  gap: 1.5,
  px: 2,
  py: 1.5,
  width: '100%',
  textAlign: 'left',
  alignItems: 'flex-start',
  borderBottom: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}`,
  '&:last-child': { borderBottom: 'none' },
  ...(unread && {
    bgcolor: (t: Theme) => (t.palette.mode === 'dark' ? 'rgba(0,212,255,0.05)' : 'rgba(0,145,179,0.05)'),
    boxShadow: (t: Theme) => `inset 3px 0 0 ${t.palette.primary.main}`,
  }),
});

export const rowIcon: Sx = {
  flexShrink: 0,
  width: 34,
  height: 34,
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  fontSize: 16,
  bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(0,212,255,0.12)' : 'rgba(0,145,179,0.10)'),
};

export const rowText: Sx = { fontSize: 13.5, lineHeight: 1.4, minWidth: 0 };

export const rowTime: Sx = {
  ml: 'auto',
  flexShrink: 0,
  fontSize: 11,
  color: 'text.secondary',
  pt: 0.25,
};

export const empty: Sx = { px: 3, py: 4, textAlign: 'center' };

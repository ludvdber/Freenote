import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

/** Le Dialog est ancré en HAUT de l'écran (pas centré) — une palette qui saute au centre
 *  quand les résultats changent de hauteur est pénible ; ancrée, seul le bas grandit. */
export const dialogPaper: Sx = {
  mt: '10vh',
  width: '100%',
  maxWidth: 640,
  borderRadius: 3,
  backgroundImage: 'none',
  bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(16,16,36,0.97)' : 'rgba(255,255,255,0.98)'),
  border: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
  overflow: 'hidden',
};

export const searchRow: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  px: 2,
  py: 1.25,
  borderBottom: '1px solid',
  borderColor: 'divider',
};

export const input: Sx = {
  flex: 1,
  '& .MuiInputBase-input': { fontSize: 16, py: 0.5 },
};

export const escHint: Sx = {
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: 10,
  px: 0.75,
  py: 0.25,
  borderRadius: 1,
  border: '1px solid',
  borderColor: 'divider',
  color: 'text.secondary',
  flexShrink: 0,
};

export const results: Sx = {
  maxHeight: '55vh',
  overflowY: 'auto',
  py: 0.5,
};

export const groupLabel: Sx = {
  px: 2,
  pt: 1.25,
  pb: 0.25,
  display: 'block',
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: 10,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  color: 'text.secondary',
};

export const row = (active: boolean): Sx => ({
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  width: '100%',
  textAlign: 'left',
  px: 2,
  py: 1,
  border: 'none',
  cursor: 'pointer',
  bgcolor: active ? 'action.selected' : 'transparent',
  color: 'text.primary',
  fontFamily: 'inherit',
  '&:hover': { bgcolor: 'action.hover' },
});

export const rowIcon: Sx = {
  width: 30,
  height: 30,
  borderRadius: 1.5,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 15,
  flexShrink: 0,
  bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(123,47,247,0.15)' : 'rgba(123,47,247,0.08)'),
};

export const rowPrimary: Sx = {
  fontWeight: 600,
  fontSize: 14,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const rowSecondary: Sx = {
  fontSize: 12,
  color: 'text.secondary',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const empty: Sx = {
  px: 2,
  py: 4,
  textAlign: 'center',
  color: 'text.secondary',
};

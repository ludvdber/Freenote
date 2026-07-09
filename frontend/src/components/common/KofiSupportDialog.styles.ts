import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

export const title: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  fontWeight: 800,
};

export const codeBox: Sx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  px: 2,
  py: 1.25,
  borderRadius: 2,
  border: (t) => `1px dashed ${t.palette.primary.main}`,
  background: (t) =>
    t.palette.mode === 'dark' ? 'rgba(0, 210, 255, 0.06)' : 'rgba(0, 145, 179, 0.06)',
};

export const code: Sx = {
  fontWeight: 800,
  letterSpacing: '0.04em',
  color: 'primary.main',
};

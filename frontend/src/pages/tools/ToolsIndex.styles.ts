import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

export const container: Sx = {
  py: 4,
  minHeight: 'calc(100vh - 200px)',
};

export const title: Sx = {
  fontWeight: 800,
  mb: 1,
  background: 'linear-gradient(135deg, #00d2ff, #7b2ff7)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

export const subtitle: Sx = {
  mb: 4,
  color: 'text.secondary',
  maxWidth: 720,
};

export const card: Sx = {
  p: 2.5,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  textDecoration: 'none',
  color: 'inherit',
  transition: 'transform 0.18s ease, border-color 0.18s ease',
  cursor: 'pointer',
  '&:hover': {
    transform: 'translateY(-4px)',
    borderColor: 'primary.main',
  },
};

export const cardIcon: Sx = {
  width: 44,
  height: 44,
  borderRadius: 2,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, rgba(0,210,255,0.18), rgba(123,47,247,0.18))',
  color: 'primary.main',
  mb: 0.5,
};

export const cardTitle: Sx = {
  fontWeight: 700,
};

export const cardDesc: Sx = {
  color: 'text.secondary',
  flexGrow: 1,
};

export const sectionHeading: Sx = {
  fontWeight: 700,
  mt: 5,
  mb: 1.5,
};

export const paragraph: Sx = {
  mb: 1.5,
  color: 'text.secondary',
  lineHeight: 1.7,
  maxWidth: 760,
};

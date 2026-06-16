import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

export const container: Sx = {
  py: { xs: 4, md: 6 },
};

export const title: Sx = {
  fontWeight: 800,
  mb: 1.5,
  background: 'linear-gradient(135deg, #00d2ff, #7b2ff7)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

export const lead: Sx = {
  fontSize: '1.15rem',
  color: 'text.secondary',
  lineHeight: 1.7,
  mb: 5,
  maxWidth: 760,
};

export const sectionHeading: Sx = {
  fontWeight: 700,
  mt: 6,
  mb: 2,
};

export const paragraph: Sx = {
  mb: 1.75,
  color: 'text.secondary',
  lineHeight: 1.8,
  maxWidth: 760,
};

export const card: Sx = {
  p: 2.75,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
};

export const cardTitle: Sx = {
  fontWeight: 700,
};

export const cardDesc: Sx = {
  color: 'text.secondary',
  lineHeight: 1.6,
};

export const step: Sx = {
  display: 'flex',
  gap: 2,
  alignItems: 'flex-start',
  mb: 2.5,
};

export const stepNumber: Sx = {
  flexShrink: 0,
  width: 38,
  height: 38,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  color: '#fff',
  background: 'linear-gradient(135deg, #00d2ff, #7b2ff7)',
};

export const ctaCard: Sx = {
  p: { xs: 3, md: 4 },
  mt: 6,
  textAlign: 'center',
  background: 'linear-gradient(135deg, rgba(0,210,255,0.10), rgba(123,47,247,0.10))',
};

export const ctaRow: Sx = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 1.5,
  justifyContent: 'center',
  mt: 2.5,
};

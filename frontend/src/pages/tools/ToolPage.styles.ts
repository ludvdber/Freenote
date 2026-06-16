import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

export const container: Sx = {
  py: 4,
  minHeight: 'calc(100vh - 200px)',
};

export const breadcrumbs: Sx = {
  mb: 2,
  fontSize: '0.85rem',
};

export const title: Sx = {
  fontWeight: 800,
  mb: 1,
  background: 'linear-gradient(135deg, #00d2ff, #7b2ff7)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

export const lead: Sx = {
  mb: 3,
  color: 'text.secondary',
  maxWidth: 720,
};

export const toolWrap: Sx = { mb: 4 };

export const sectionCard: Sx = {
  p: { xs: 2.5, sm: 3.5 },
  mt: 4,
};

export const sectionHeading: Sx = {
  fontWeight: 700,
  mb: 1.5,
  mt: 3,
  '&:first-of-type': { mt: 0 },
};

export const paragraph: Sx = {
  mb: 1.5,
  color: 'text.secondary',
  lineHeight: 1.7,
};

export const exampleList: Sx = {
  m: 0,
  pl: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
};

export const exampleItem: Sx = {
  display: 'flex',
  gap: 1.25,
  alignItems: 'flex-start',
  color: 'text.secondary',
  lineHeight: 1.6,
  '&::before': {
    content: '"›"',
    color: 'primary.main',
    fontWeight: 800,
    flexShrink: 0,
  },
};

export const backLink: Sx = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.5,
  mt: 4,
  fontWeight: 600,
};

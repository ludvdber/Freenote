import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

// The glassmorphism theme makes every MuiPaper semi-transparent (rgba + backdropFilter), which
// let the hero text bleed through the mobile drawer. Force an opaque, theme-aware background.
export const drawerPaper: Sx = {
  width: 260,
  backgroundColor: 'background.default',
  backgroundImage: 'none',
  backdropFilter: 'none',
};

export const drawerBox: Sx = { width: 260, pt: 2 };

export const closeRow: Sx = {
  display: 'flex',
  justifyContent: 'flex-end',
  px: 1,
};

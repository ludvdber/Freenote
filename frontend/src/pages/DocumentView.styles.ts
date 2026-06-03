import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

export const header: Sx = { mb: 3 };

export const chipsRow: Sx = {
  display: 'flex',
  gap: 1,
  mb: 2,
  flexWrap: 'wrap',
};

export const categoryChip = (color: string): Sx => ({
  bgcolor: `${color}20`,
  color,
  border: `1px solid ${color}66`,
  fontWeight: 600,
});

export const title: Sx = { fontWeight: 800, mb: 1 };

export const subtitle: Sx = { mb: 2 };

export const metaCard: Sx = { p: 3, mb: 3 };

export const summaryCard: Sx = { p: 3, mb: 3 };

export const summaryLabel: Sx = { mb: 1 };

export const ratingRow: Sx = {
  display: 'flex',
  gap: 2,
  mb: 3,
  flexWrap: 'wrap',
  alignItems: 'center',
};

export const ratingInner: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
};

export const actionsRow: Sx = {
  display: 'flex',
  gap: 2,
  flexWrap: 'wrap',
};

export const reportRow: Sx = {
  mt: 2,
  display: 'flex',
  gap: 1,
};

export const pdfViewerWrapper: Sx = {
  mb: 3,
  borderRadius: 3,
  overflow: 'hidden',
  border: (t) =>
    t.palette.mode === 'dark'
      ? '1px solid rgba(255,255,255,0.08)'
      : '1px solid rgba(0,0,0,0.1)',
  bgcolor: (t) =>
    t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
  minHeight: 600,
  position: 'relative',
};

export const pdfIframe: Sx = {
  width: '100%',
  height: { xs: '60vh', md: '80vh' },
  border: 'none',
  display: 'block',
};

export const pdfLoading: Sx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 300,
};

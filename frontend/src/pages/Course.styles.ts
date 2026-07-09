import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

// Bandeau page cours (maquette « Cartographie du savoir » validée 2026-07-09, copy sobre).

export const hero: Sx = {
  position: 'relative',
  overflow: 'hidden',
  p: { xs: 2.5, md: '30px 34px 26px' },
  mb: 3,
};

// Voile dégradé posé en overlay (et non en background sur la carte : MuiPaper force
// backgroundImage: none, le glass de GlassCard doit rester intact).
export const heroGlow: Sx = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  background: (t) => t.palette.mode === 'dark'
    ? 'linear-gradient(180deg, rgba(0,212,255,0.055), rgba(123,47,247,0.05) 70%, transparent)'
    : 'linear-gradient(180deg, rgba(0,212,255,0.07), rgba(123,47,247,0.04) 70%, transparent)',
};

export const heroContent: Sx = { position: 'relative' };

export const kicker: Sx = {
  fontFamily: 'ui-monospace, monospace',
  fontWeight: 800,
  fontSize: 11.5,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'primary.main',
};

export const title: Sx = {
  fontWeight: 800,
  lineHeight: 1.15,
  my: 0.5,
  maxWidth: '18em',
  textWrap: 'balance',
};

export const subline: Sx = { color: 'text.secondary', fontSize: 14.5, mb: 2 };

export const statsRow: Sx = {
  display: 'flex',
  gap: { xs: 2.5, md: 3.5 },
  flexWrap: 'wrap',
  mb: 2.5,
};

export const statValue: Sx = {
  fontSize: 22,
  fontWeight: 800,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.2,
};

export const statLabel: Sx = { fontSize: 12, color: 'text.secondary' };

export const ctaRow: Sx = { display: 'flex', gap: 1.5, flexWrap: 'wrap' };

// Tuiles « Réviser ce cours » — rangée horizontale sous le bandeau.
export const reviseRow: Sx = {
  display: 'flex',
  gap: 1.5,
  flexWrap: 'wrap',
  mb: 4,
};

export const reviseTile: Sx = {
  flex: '1 1 230px',
  maxWidth: { md: 360 },
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  p: '13px 16px',
  borderRadius: '14px',
  textDecoration: 'none',
  color: 'inherit',
  bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.7)'),
  border: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
  transition: 'transform 0.18s ease, border-color 0.18s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    borderColor: 'primary.main',
  },
};

export const reviseTileTitle: Sx = {
  fontWeight: 700,
  fontSize: 14,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const docsHeading: Sx = { fontWeight: 700, fontSize: 19, mb: 2 };

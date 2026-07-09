import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

// Layout « Mission Control » : sidebar par domaines (md+) + contenu. En dessous de md la sidebar
// est remplacée par un Select groupé (elle prendrait tout l'écran d'un téléphone).
export const layout: Sx = {
  display: 'flex',
  gap: 3,
  alignItems: 'flex-start',
};

export const side: Sx = {
  width: 225,
  flexShrink: 0,
  position: 'sticky',
  top: 88,
  display: { xs: 'none', md: 'flex' },
  flexDirection: 'column',
  gap: 1.5,
  p: 1.5,
  // Neutralise le lift au survol de GlassCard — une nav qui « décolle » distrait.
  '&:hover': { transform: 'none', boxShadow: 'none' },
};

export const main: Sx = {
  flex: 1,
  minWidth: 0,
};

export const groupTitle: Sx = {
  px: 1,
  pt: 0.5,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'text.secondary',
};

export const navItem = (active: boolean): Sx => ({
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  width: '100%',
  px: 1,
  py: 0.75,
  borderRadius: 1.5,
  border: 'none',
  font: 'inherit',
  fontSize: 14,
  fontWeight: active ? 700 : 500,
  textAlign: 'left',
  cursor: 'pointer',
  color: active ? 'primary.main' : 'text.primary',
  bgcolor: active
    ? (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)')
    : 'transparent',
  '&:hover': {
    bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
  },
  '& svg': { fontSize: 18, opacity: active ? 1 : 0.7 },
});

export const navLabel: Sx = { flex: 1, minWidth: 0 };

/** Badge de file d'attente (rouge = travail en attente, visible en permanence). */
export const navBadge: Sx = {
  minWidth: 20,
  height: 20,
  px: 0.5,
  borderRadius: 10,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 800,
  bgcolor: 'error.main',
  color: 'common.white',
};

export const mobileNav: Sx = {
  display: { xs: 'block', md: 'none' },
  mb: 2.5,
};

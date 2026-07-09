import type { SxProps, Theme } from '@mui/material';
import { TOKENS } from '@/theme/tokens';

type Sx = SxProps<Theme>;

export const headerCard: Sx = {
  p: 3,
  mb: 3,
  display: 'flex',
  alignItems: 'center',
  gap: 2.5,
  flexWrap: 'wrap',
};

export const avatar = (initial: string): Sx => ({
  width: 64,
  height: 64,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 28,
  fontWeight: 800,
  color: '#fff',
  background: `linear-gradient(135deg, #00d2ff, #7b2ff7)`,
  flexShrink: 0,
  // initial is consumed for accessibility via aria-label, kept here so callers stay symmetrical
  '&::before': { content: `"${initial}"` },
});

export const headerInfo: Sx = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 200,
  gap: 0.5,
};

export const headerChips: Sx = {
  display: 'flex',
  gap: 0.75,
  flexWrap: 'wrap',
  alignItems: 'center',
};

export const headerActions: Sx = {
  display: 'flex',
  gap: 1,
  flexWrap: 'wrap',
  ml: 'auto',
};

export const sectionCard: Sx = {
  p: 2.5,
  mb: 2.5,
};

export const sectionTitle: Sx = {
  fontWeight: 700,
  mb: 2,
  display: 'flex',
  alignItems: 'center',
  gap: 1,
};

export const formStack: Sx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

export const switchRow: Sx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0.25,
  py: 0.5,
};

// Pas de marge négative ici : elle faisait chevaucher le texte d'aide sur la ligne du
// switch dès que l'aide passait sur deux lignes (chevauchement signalé sur /profile).
export const switchHelp: Sx = {
  ml: 5,
};

export const statRow: Sx = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  py: 1,
  borderBottom: (t) =>
    t.palette.mode === 'dark'
      ? '1px solid rgba(255,255,255,0.06)'
      : '1px solid rgba(0,0,0,0.06)',
  '&:last-child': { borderBottom: 'none' },
};

export const statLabel: Sx = { color: 'text.secondary' };

export const statValue: Sx = {
  fontWeight: 700,
  fontSize: '1.1rem',
  color: TOKENS.rating.main,
};

export const favoritesList: Sx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0.5,
};

export const favoriteItem: Sx = {
  display: 'block',
  px: 1.25,
  py: 1,
  borderRadius: 1.5,
  textDecoration: 'none',
  color: 'inherit',
  borderLeft: '2px solid transparent',
  transition: 'background-color 0.15s, border-color 0.15s',
  '&:hover': {
    bgcolor: (t) =>
      t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    borderLeftColor: 'primary.main',
  },
};

export const favoriteTitle: Sx = {
  fontWeight: 600,
  display: 'block',
};

export const mandateRow: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  px: 1.5,
  py: 1,
  borderRadius: 1.5,
  bgcolor: (t) =>
    t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)',
  flexWrap: 'wrap',
};

export const dangerCard: Sx = {
  p: 2.5,
  mt: 4,
  border: '1px solid rgba(244, 67, 54, 0.4)',
  bgcolor: 'rgba(244, 67, 54, 0.05) !important',
};

export const dangerHeader: Sx = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 2,
  flexWrap: 'wrap',
};

export const successAlert: Sx = { mb: 2 };

export const avatarOptions: Sx = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
  gap: 1.5,
};

// --- Palettes d'accent (perk supporters) ---

export const paletteRow: Sx = {
  display: 'flex',
  gap: 1.25,
  flexWrap: 'wrap',
};

/** Pastille bicolore d'une palette (diagonale primary → secondary de la variante du mode). */
export const paletteSwatch = (colors: [string, string], selected: boolean, disabled: boolean): Sx => ({
  width: 44,
  height: 44,
  borderRadius: '50%',
  background: `linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)`,
  border: '3px solid',
  borderColor: selected ? 'primary.main' : 'transparent',
  outline: (t) => (t.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.15)'),
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.4 : 1,
  p: 0,
  transition: 'transform 0.15s, border-color 0.15s',
  '&:hover': disabled ? {} : { transform: 'scale(1.1)' },
});

export const supportCode: Sx = {
  px: 1,
  py: 0.25,
  borderRadius: 1.5,
  border: (t) => `1px dashed ${t.palette.primary.main}`,
  color: 'primary.main',
  fontWeight: 700,
};

export const supportCodeRow: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.75,
  flexWrap: 'wrap',
  mb: 1.5,
};

export const supportPerks: Sx = {
  m: 0,
  pl: 2.5,
  display: 'flex',
  flexDirection: 'column',
  gap: 0.5,
};

export const avatarOption = (selected: boolean, disabled: boolean): Sx => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 0.5,
  p: 1.5,
  border: '2px solid',
  borderColor: selected ? 'primary.main' : 'transparent',
  borderRadius: 2,
  bgcolor: (t) =>
    selected
      ? t.palette.mode === 'dark'
        ? 'rgba(0,210,255,0.08)'
        : 'rgba(0,210,255,0.06)'
      : 'transparent',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.45 : 1,
  font: 'inherit',
  color: 'inherit',
  transition: 'background-color 0.15s, border-color 0.15s',
  '&:hover': disabled
    ? {}
    : {
        bgcolor: (t) =>
          t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      },
});

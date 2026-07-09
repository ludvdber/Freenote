import { alpha } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material';
import { accentGradientAlpha } from '@/theme/accent';

type Sx = SxProps<Theme>;

export const header: Sx = { mb: 2 };

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

export const subtitle: Sx = { mb: 0.75 };

// Ligne méta compacte sous le sous-titre : année · note · vues · date relative · prof · langue.
// Remplace l'ancienne grosse carte méta 5 colonnes (maquette 8 validée).
export const metaLine: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  flexWrap: 'wrap',
  color: 'text.secondary',
};

export const metaItem: Sx = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.5,
};

export const actionsRow: Sx = {
  display: 'flex',
  gap: 2,
  flexWrap: 'wrap',
  alignItems: 'center',
  mt: 2.5,
  mb: 2.5,
};

export const reportRow: Sx = {
  mb: 2,
  display: 'flex',
  gap: 1,
};

// ——— Nudge post-téléchargement (timing Udemy/Booking : on demande la note juste après la
// consommation de la valeur, jamais à l'arrivée sur la page) ———
export const nudge: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  flexWrap: 'wrap',
  px: 2.5,
  py: 1.75,
  borderRadius: 3.5,
  mb: 2.5,
  background: (t) => accentGradientAlpha(t, t.palette.mode === 'dark' ? 0.10 : 0.08),
  border: (t) => `1px solid ${alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.3 : 0.35)}`,
};

export const nudgeText: Sx = { flex: 1, minWidth: 200 };

// ——— Layout deux colonnes : viewer à gauche, rail à droite (maquette 8) ———
export const cols: Sx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 330px' },
  gap: 2.5,
  alignItems: 'start',
};

export const rail: Sx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
};

// ——— Carte notation : bordure dégradée violet→cyan, LA carte mise en avant du rail ———
export const rateCard: Sx = {
  p: 2.5,
  borderRadius: 4,
  border: '1.5px solid transparent',
  background: (t) =>
    t.palette.mode === 'dark'
      ? `linear-gradient(#12122a, #12122a) padding-box, ${accentGradientAlpha(t, 0.5)} border-box`
      : `linear-gradient(#ffffff, #ffffff) padding-box, ${accentGradientAlpha(t, 0.45)} border-box`,
};

export const rateTitle: Sx = { fontWeight: 800, mb: 0.5 };

export const rateWhy: Sx = { display: 'block', mb: 1.5 };

export const rateMeta: Sx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1,
  mt: 1,
};

// Chip « +2 XP » : la récompense du noteur, annoncée à côté des étoiles (règle validée 2026-07-07).
export const xpChip: Sx = {
  fontWeight: 800,
  fontSize: '0.68rem',
  height: 22,
  bgcolor: (t) => alpha(t.palette.primary.main, 0.15),
  color: 'primary.main',
  border: 'none',
};

// État « première note » — remplace la ligne moyenne/votes quand ratingCount = 0.
export const zeroState: Sx = {
  display: 'block',
  mt: 1.5,
  px: 1.75,
  py: 1.25,
  borderRadius: 2.5,
  bgcolor: 'rgba(255,217,61,0.08)',
  border: '1px dashed rgba(255,217,61,0.4)',
  color: (t) => (t.palette.mode === 'dark' ? '#ffd93d' : '#8a6d00'),
};

// ——— Cartes secondaires du rail (réviser / sommaire / du même cours) ———
export const sideCard: Sx = { p: 2.25 };

export const sideTitle: Sx = {
  display: 'block',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  fontSize: '0.72rem',
  color: 'text.secondary',
  mb: 1.25,
};

// « Réviser ce cours » — scrollable dès 3 éléments (demande 2026-07-07 : éviter une colonne immense).
export const reviseList = (scrollable: boolean): Sx => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 1.25,
  ...(scrollable ? { maxHeight: 250, overflowY: 'auto', pr: 0.5 } : null),
});

export const reviseRow: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  px: 1.5,
  py: 1.25,
  borderRadius: 3,
  flexShrink: 0,
  border: (t) =>
    `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
  bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
  textDecoration: 'none',
  color: 'inherit',
  transition: 'border-color 0.15s, transform 0.15s',
  '&:hover': { borderColor: 'primary.main', transform: 'translateY(-1px)' },
};

export const reviseTitle: Sx = {
  fontWeight: 700,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// Sommaire du PDF — scrollable au-delà de 10 entrées (demande 2026-07-07).
export const tocList = (scrollable: boolean): Sx =>
  scrollable ? { maxHeight: 320, overflowY: 'auto', pr: 0.5 } : {};

export const tocRow = (sub: boolean): Sx => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 1.5,
  width: '100%',
  textAlign: 'left',
  py: 0.9,
  pl: sub ? 1.75 : 0,
  pr: 0,
  fontFamily: 'inherit',
  fontSize: sub ? '0.78rem' : '0.83rem',
  color: 'text.secondary',
  bgcolor: 'transparent',
  border: 'none',
  borderTop: (t) =>
    `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
  cursor: 'pointer',
  transition: 'color 0.15s',
  '&:hover': { color: 'primary.main' },
  '&:first-of-type': { borderTop: 'none' },
});

export const tocEntry: Sx = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// ——— Navigation précédent/suivant du même cours (pattern de la page news) ———
export const pnGrid: Sx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
  gap: 1.5,
  mt: 2,
};

export const pnCard = (alignRight: boolean): Sx => ({
  px: 2,
  py: 1.75,
  display: 'block',
  textDecoration: 'none',
  color: 'inherit',
  textAlign: alignRight ? 'right' : 'left',
});

export const pnLabel: Sx = {
  display: 'block',
  fontSize: '0.66rem',
  fontWeight: 800,
  letterSpacing: '0.8px',
  textTransform: 'uppercase',
  color: 'text.secondary',
  mb: 0.5,
};

export const pnTitle: Sx = {
  fontWeight: 700,
  fontSize: '0.86rem',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

// ——— « Du même cours » : liste compacte titre + vues ———
export const sameRow: Sx = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 1.5,
  py: 1.1,
  borderTop: (t) =>
    `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
  textDecoration: 'none',
  color: 'inherit',
  '&:first-of-type': { borderTop: 'none' },
  '&:hover .same-title': { color: 'primary.main' },
};

export const sameTitle: Sx = {
  fontWeight: 700,
  fontSize: '0.85rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  transition: 'color 0.15s',
};

export const sameViews: Sx = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.5,
  color: 'text.secondary',
  fontSize: '0.75rem',
  whiteSpace: 'nowrap',
  flexShrink: 0,
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

export const pdfLoading: Sx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 300,
};

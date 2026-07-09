import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

export const section: Sx = { py: { xs: 1, md: 2 } };

// Les animations (vagues + bulles) sont désactivées globalement sous prefers-reduced-motion
// par le MuiCssBaseline du thème (animation-duration: 0.01ms) — rien à redéclarer ici.
export const card: Sx = {
  p: { xs: 2.5, md: 3 },
  display: 'flex',
  flexDirection: 'column',
  gap: 1.75,
  // Vagues : le SVG fait 200 % de la largeur du liquide, période = 12,5 % → -50 % boucle sans couture.
  '& .fn-wave': { animation: 'fnWave 7s linear infinite' },
  '& .fn-wave2': { animation: 'fnWave 11s linear infinite reverse' },
  '@keyframes fnWave': {
    from: { transform: 'translateX(0)' },
    to: { transform: 'translateX(-50%)' },
  },
  '& .fn-bubble': { animation: 'fnBubble 3.2s ease-in infinite' },
  '& .fn-b2': { animationDelay: '1.1s', animationDuration: '4s' },
  '& .fn-b3': { animationDelay: '2.2s', animationDuration: '3.6s' },
  '@keyframes fnBubble': {
    '0%': { transform: 'translateY(0)', opacity: 0 },
    '15%': { opacity: 0.7 },
    '100%': { transform: 'translateY(-18px)', opacity: 0 },
  },
};

export const headerRow: Sx = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 2,
  flexWrap: 'wrap',
};

export const title: Sx = { fontWeight: 800 };

export const amounts: Sx = { fontWeight: 800 };

export const pct: Sx = { color: 'text.secondary', fontWeight: 700, fontSize: '0.85em' };

// Tube horizontal : verre discret, liquide clipé par l'overflow.
export const track: Sx = {
  position: 'relative',
  height: 28,
  borderRadius: 999,
  overflow: 'hidden',
  background: (t) =>
    t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
  border: (t) =>
    `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
};

export const fill = (pct: number): Sx => ({
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 0,
  width: `${pct}%`,
  overflow: 'hidden',
  borderRadius: pct >= 100 ? 999 : '999px 0 0 999px',
  background: (t) =>
    `linear-gradient(90deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`,
  transition: 'width 0.8s ease',
});

export const wave: Sx = {
  position: 'absolute',
  inset: 0,
  width: '200%',
  height: '100%',
};

export const bubble = (leftPct: number, size: number): Sx => ({
  position: 'absolute',
  left: `${leftPct}%`,
  bottom: 2,
  width: size,
  height: size,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.55)',
});

export const tick = (pct: number): Sx => ({
  position: 'absolute',
  left: `${pct}%`,
  top: 0,
  bottom: 0,
  width: '1px',
  background: (t) =>
    t.palette.mode === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)',
});

export const footerRow: Sx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 2,
  flexWrap: 'wrap',
};

export const status: Sx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0.25,
  minWidth: 200,
  flex: 1,
};

export const coveredText: Sx = { fontWeight: 700, color: 'success.main' };

import type { SxProps, Theme } from '@mui/material';

type Sx = SxProps<Theme>;

// Bande haute du hero (au-dessus du titre), derrière le contenu, jamais interactive.
// La hauteur suit le SVG (ratio fixe 1100:260) : les labels positionnés en % restent alignés
// sur leurs étoiles quelle que soit la largeur.
export const wrapper: Sx = {
  position: 'absolute',
  top: { md: '5%', lg: '7%' },
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'min(1100px, 92%)',
  pointerEvents: 'none',
  zIndex: 0,
  display: { xs: 'none', md: 'block' },
};

export const svg: Sx = {
  display: 'block',
  width: '100%',
  height: 'auto',
  overflow: 'visible',
};

export const constellationLine: Sx = {
  stroke: (t) => (t.palette.mode === 'dark' ? 'rgba(0,210,255,0.20)' : 'rgba(123,47,247,0.20)'),
  strokeWidth: 1.5,
};

// Halo pulsant : delay étagé par étoile, cadence plus vive pour les sections actives.
export const starHalo = (index: number, share: number): Sx => ({
  fill: (t) => (t.palette.mode === 'dark' ? 'rgba(0,210,255,0.16)' : 'rgba(123,47,247,0.14)'),
  '@keyframes starPulse': {
    '0%, 100%': { opacity: 0.3 },
    '50%': { opacity: 0.9 },
  },
  animation: `starPulse ${3.6 - share * 1.4}s ease-in-out infinite`,
  animationDelay: `${index * 0.45}s`,
  '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0.5 },
});

export const starCore: Sx = {
  fill: (t) => (t.palette.mode === 'dark' ? '#e6faff' : '#7b2ff7'),
};

// Nom de section ancré sous son étoile (mêmes coordonnées % que le SVG).
export const starLabel = (x: number, y: number): Sx => ({
  position: 'absolute',
  left: `${x}%`,
  top: `${y}%`,
  transform: 'translate(-50%, 14px)',
  fontSize: 10,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  color: 'text.secondary',
  opacity: 0.55,
});

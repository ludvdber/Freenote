import { alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material';

/**
 * Dégradé d'accent du thème actif — cyan→violet par défaut, la palette du supporter sinon.
 * À utiliser partout où l'ancien `linear-gradient(135deg, #00d2ff, #7b2ff7)` était codé en dur
 * ET où la couleur est décorative (hero, avatars lettre, 404, cartes accentuées).
 * Ne PAS l'utiliser pour les couleurs sémantiques : catégories, paliers, charts admin (CVD),
 * ni pour la marque elle-même (logo Navbar, og-image).
 */
export const accentGradient = (t: Theme, deg = 135): string =>
  `linear-gradient(${deg}deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`;

/** Variante translucide (washes de fond, bordures dégradées). */
export const accentGradientAlpha = (t: Theme, opacity: number, deg = 135): string =>
  `linear-gradient(${deg}deg, ${alpha(t.palette.primary.main, opacity)}, ${alpha(t.palette.secondary.main, opacity)})`;

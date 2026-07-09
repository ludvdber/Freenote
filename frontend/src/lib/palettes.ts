// Palettes d'accent — perk supporters Ko-fi (don < 5 € : 30 jours ; don ≥ 5 € : illimité).
// Chaque palette remplace primary/secondary du thème MUI (boutons, liens, chips, focus) ; le fond
// cosmique et les tokens de marque (gradients du hero, couleurs de catégories) ne bougent pas.
// ⚠️ Les ids sont AUSSI whitelistés côté backend (UpdateProfileRequest @Pattern) — garder en phase.

export interface AccentPalette {
  id: string;
  /** Émoji de swatch (décoratif — le nom traduit vit sous profile.palette.names.{id}). */
  emoji: string;
  dark: { primary: string; secondary: string };
  /** Variantes assombries pour le thème clair (contraste), même logique que le thème par défaut. */
  light: { primary: string; secondary: string };
}

/** Thème par défaut (cosmique cyan/violet) — ce que voit tout le monde sans palette. */
export const DEFAULT_ACCENT: Omit<AccentPalette, 'id' | 'emoji'> = {
  dark: { primary: '#00d2ff', secondary: '#7b2ff7' },
  light: { primary: '#0091b3', secondary: '#6a1be0' },
};

export const ACCENT_PALETTES: AccentPalette[] = [
  {
    id: 'aurora',
    emoji: '🌌',
    dark: { primary: '#34d399', secondary: '#22d3ee' },
    light: { primary: '#047857', secondary: '#0e7490' },
  },
  {
    id: 'nebula',
    emoji: '🌸',
    dark: { primary: '#f472b6', secondary: '#a78bfa' },
    light: { primary: '#be185d', secondary: '#6d28d9' },
  },
  {
    id: 'solar',
    emoji: '☀️',
    dark: { primary: '#fbbf24', secondary: '#fb7185' },
    light: { primary: '#b45309', secondary: '#be123c' },
  },
  {
    id: 'ocean',
    emoji: '🌊',
    dark: { primary: '#38bdf8', secondary: '#2dd4bf' },
    light: { primary: '#0369a1', secondary: '#0f766e' },
  },
  {
    id: 'ruby',
    emoji: '💎',
    dark: { primary: '#f87171', secondary: '#f472b6' },
    light: { primary: '#b91c1c', secondary: '#be185d' },
  },
];

/** Retourne la palette demandée, ou null pour un id inconnu/absent (⇒ thème par défaut). */
export function accentFor(id: string | null | undefined): AccentPalette | null {
  if (!id) return null;
  return ACCENT_PALETTES.find((p) => p.id === id) ?? null;
}

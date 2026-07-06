// Paliers célestes — niveaux 100 % calculés côté client à partir de l'XP existant (aucune
// migration, aucune API). Échelle recalibrée ×1,2 par rapport à la proposition d'audit pour
// que le dernier palier (Galaxie) tombe à 3000 XP (décision produit 2026-07-06).
// Chaque palier a une couleur « dark » (fond sombre) et une variante « light » plus saturée,
// car le jaune/cyan purs manquent de contraste sur fond clair.

export interface Level {
  /** i18n key under `levels.<key>` */
  key: string;
  minXp: number;
  /** Text/accent color on the dark theme. */
  color: string;
  /** Text/accent color on the light theme (darker for contrast). */
  colorLight: string;
  /** CSS gradient for the top tier — rendered as gradient text where supported. */
  gradient?: string;
}

export const LEVELS: readonly Level[] = [
  { key: 'stardust', minXp: 0, color: '#94a3b8', colorLight: '#64748b' },
  { key: 'meteor', minXp: 60, color: '#00d2ff', colorLight: '#0891b2' },
  { key: 'comet', minXp: 180, color: '#3b82f6', colorLight: '#2563eb' },
  { key: 'star', minXp: 360, color: '#ffd93d', colorLight: '#ca8a04' },
  { key: 'supernova', minXp: 720, color: '#f97316', colorLight: '#ea580c' },
  { key: 'constellation', minXp: 1440, color: '#a855f7', colorLight: '#7b2ff7' },
  {
    key: 'galaxy',
    minXp: 3000,
    color: '#00d2ff',
    colorLight: '#7b2ff7',
    gradient: 'linear-gradient(135deg, #7b2ff7, #00d2ff)',
  },
] as const;

/** The tier an XP total belongs to. Negative/invalid XP clamps to the first tier. */
export function levelFor(xp: number): Level {
  const safe = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (safe >= level.minXp) current = level;
    else break;
  }
  return current;
}

/** The next tier to reach, or null when already at the top (Galaxie). */
export function nextLevel(xp: number): Level | null {
  const current = levelFor(xp);
  const idx = LEVELS.indexOf(current);
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

export interface LevelProgress {
  current: Level;
  next: Level | null;
  /** 0..1 within the current tier; 1 at the top tier. */
  ratio: number;
  /** XP still missing to reach `next`; 0 at the top tier. */
  remaining: number;
}

/** Progress within the current tier — drives the « 480/720 → Supernova » bars. */
export function levelProgress(xp: number): LevelProgress {
  const safe = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  const current = levelFor(safe);
  const next = nextLevel(safe);
  if (!next) return { current, next: null, ratio: 1, remaining: 0 };
  const span = next.minXp - current.minXp;
  const ratio = span > 0 ? (safe - current.minXp) / span : 1;
  return { current, next, ratio: Math.min(1, Math.max(0, ratio)), remaining: next.minXp - safe };
}

/** Palette color for a tier in the active theme mode. */
export function levelColor(level: Level, mode: 'light' | 'dark'): string {
  return mode === 'dark' ? level.color : level.colorLight;
}

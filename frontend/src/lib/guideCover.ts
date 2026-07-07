/**
 * Couverture automatique d'un guide — la catégorie est un texte LIBRE saisi par l'admin,
 * donc rien n'est configuré à la création :
 *  - les catégories CONNUES (mots-clés) reçoivent leur émoji + leur teinte attitrée
 *    (Java → ☕ orange, SQL → 🗄️ vert, …) ;
 *  - une catégorie inconnue reçoit 📖 + une teinte DÉRIVÉE d'un hash stable du texte
 *    (« Compta » tombera toujours sur la même couleur, quel que soit le moment).
 * Les gradients sont semi-transparents (même principe que les couvertures de l'explorer) :
 * profonds sur le navy en dark, pastels sur le blanc en light — aucune variante dédiée.
 */

export interface GuideCover {
  /** CSS background de la couverture. */
  gradient: string;
  /** Couleur d'accent (chip posé sur le scrim navy → variante dark quel que soit le thème). */
  color: string;
  /** Émoji filigrane. */
  emoji: string;
}

interface PaletteEntry {
  gradient: string;
  color: string;
}

// Miroir des teintes de couvertures de DocumentCard (identité de cartes unifiée).
const PALETTE: PaletteEntry[] = [
  { gradient: 'linear-gradient(130deg, rgba(0,210,255,0.30), rgba(0,80,125,0.42))', color: '#00d2ff' },
  { gradient: 'linear-gradient(130deg, rgba(252,166,82,0.30), rgba(120,60,8,0.45))', color: '#fca652' },
  { gradient: 'linear-gradient(130deg, rgba(74,222,128,0.26), rgba(12,82,45,0.45))', color: '#4ade80' },
  { gradient: 'linear-gradient(130deg, rgba(96,165,250,0.30), rgba(18,55,120,0.45))', color: '#60a5fa' },
  { gradient: 'linear-gradient(130deg, rgba(177,140,255,0.28), rgba(62,35,120,0.45))', color: '#b18cff' },
  { gradient: 'linear-gradient(130deg, rgba(255,143,163,0.28), rgba(110,18,55,0.45))', color: '#ff8fa3' },
  { gradient: 'linear-gradient(130deg, rgba(255,217,61,0.26), rgba(120,82,8,0.42))', color: '#ffd93d' },
];

const FALLBACK_EMOJI = '📖';

// Testé sur la catégorie NORMALISÉE (minuscules, accents retirés). L'ordre compte :
// premier match gagne (« Base de données » doit matcher sql avant tout le reste).
const KEYWORDS: Array<{ pattern: RegExp; emoji: string; palette: number }> = [
  { pattern: /java(?!script)/, emoji: '☕', palette: 1 },
  { pattern: /sql|base.?de.?donn|donnees|database|\bbd\b/, emoji: '🗄️', palette: 2 },
  { pattern: /reseau|network|ipv?[46]?\b|tcp|osi|dns/, emoji: '🌐', palette: 3 },
  { pattern: /algo|complexite|structure de/, emoji: '🧠', palette: 4 },
  { pattern: /\bgit\b|version/, emoji: '🌿', palette: 5 },
  { pattern: /logique|bool|binaire/, emoji: '⚡', palette: 6 },
  { pattern: /poo|objet/, emoji: '🧩', palette: 1 },
  { pattern: /web|html|css|javascript/, emoji: '🕸️', palette: 0 },
  { pattern: /secu/, emoji: '🔒', palette: 5 },
  { pattern: /compta|fisc|finance/, emoji: '💰', palette: 2 },
  { pattern: /langue|anglais|neerlandais|espagnol|italien/, emoji: '💬', palette: 0 },
  { pattern: /metho|tfe|memoire|redaction/, emoji: '✍️', palette: 4 },
];

const normalize = (s: string): string =>
  s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().trim();

/** djb2 — stable, rapide, suffisant pour répartir quelques catégories sur la palette. */
const hash = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
};

export function guideCover(category: string | null | undefined): GuideCover {
  if (!category || !category.trim()) {
    return { ...PALETTE[0], emoji: FALLBACK_EMOJI };
  }
  const n = normalize(category);
  const kw = KEYWORDS.find((k) => k.pattern.test(n));
  if (kw) {
    return { ...PALETTE[kw.palette], emoji: kw.emoji };
  }
  return { ...PALETTE[hash(n) % PALETTE.length], emoji: FALLBACK_EMOJI };
}

import { TOKENS } from '@/theme/tokens';

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

/** Nuance de couverture par cours (djb2 → ±16°) : le catalogue public n'a que 2 catégories
 *  (NOTES/DIVERS), sans variation la vitrine anonyme est une mer de couvertures identiques. */
export function courseHueShift(courseName: string | null | undefined): number {
  if (!courseName) return 0;
  let h = 5381;
  for (let i = 0; i < courseName.length; i++) h = ((h << 5) + h + courseName.charCodeAt(i)) >>> 0;
  return (h % 33) - 16;
}

export function formatDate(dateStr: string, locale: string = 'fr'): string {
  return new Date(dateStr).toLocaleDateString(locale.startsWith('fr') ? 'fr-BE' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatRelativeDate(dateStr: string, locale: string = 'fr'): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay >= 7) {
    return date.toLocaleDateString(locale.startsWith('fr') ? 'fr-BE' : 'en-GB', {
      month: 'short',
      day: 'numeric',
    });
  }
  if (diffDay >= 1) return locale.startsWith('fr') ? `Il y a ${diffDay}j` : `${diffDay}d ago`;
  if (diffHour >= 1) return locale.startsWith('fr') ? `Il y a ${diffHour}h` : `${diffHour}h ago`;
  if (diffMin >= 1) return locale.startsWith('fr') ? `Il y a ${diffMin}min` : `${diffMin}min ago`;
  return locale.startsWith('fr') ? 'À l\'instant' : 'Just now';
}

const DAY_MS = 86_400_000;

/** « Nouveau » : publié il y a moins de 7 jours. Prime sur « 🔥 » — jamais les deux. */
export function isNewDoc(createdAt: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(createdAt).getTime() < 7 * DAY_MS;
}

/** « 🔥 » : rythme de vues soutenu dans la durée (≥ 2 vues/jour de moyenne ET ≥ 20 vues). */
export function isHotDoc(createdAt: string, downloadCount: number, now: Date = new Date()): boolean {
  const days = Math.max(1, (now.getTime() - new Date(createdAt).getTime()) / DAY_MS);
  return downloadCount >= 20 && downloadCount / days >= 2;
}

/** Jours calendaires (minuit à minuit) d'ici une date ISO `yyyy-mm-dd`.
 *  0 = aujourd'hui, négatif = passée — la bannière compte à rebours se masque alors d'elle-même. */
export function daysUntil(dateStr: string, now: Date = new Date()): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - todayStart.getTime()) / DAY_MS);
}

/** Pictogramme par catégorie — filigrane des couvertures de cartes + chips de l'explorer.
 *  Des émojis, pas des initiales : « E » était ambigu (Examen/Exercices). */
const CATEGORY_EMOJI: Record<string, string> = {
  SYNTHESE: '📘',
  EXAMEN: '📝',
  NOTES: '✏️',
  EXERCICES: '🧮',
  COURS: '📚',
  TFE: '🎓',
  DIVERS: '📦',
};

export function categoryEmoji(category: string): string {
  return CATEGORY_EMOJI[category] ?? '📄';
}

/** Strips HTML tags and collapses whitespace — for excerpts/reading-time off blog content. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Rough reading time in minutes (~200 words/min) from an HTML string; min 1 when non-empty. */
export function readingMinutes(html: string | null | undefined): number {
  if (!html) return 0;
  const words = stripHtml(html).split(' ').filter(Boolean).length;
  return words ? Math.max(1, Math.round(words / 200)) : 0;
}

// Sur fond clair, les teintes les plus claires (jaune NOTES, cyan SYNTHESE) manquent de
// contraste — variantes assombries pour le mode light uniquement.
const CATEGORY_LIGHT_OVERRIDES: Record<string, string> = {
  NOTES: '#a16207',
  SYNTHESE: '#0891b2',
};

export function categoryColor(category: string, mode: 'light' | 'dark' = 'dark'): string {
  const key = category as keyof typeof TOKENS.categories;
  const base = TOKENS.categories[key] ?? '#888';
  return mode === 'light' ? (CATEGORY_LIGHT_OVERRIDES[category] ?? base) : base;
}

/**
 * Pulls the backend ErrorResponse `message` out of an Axios error, falling back to
 * `fallback` when the shape doesn't match (network error, non-JSON body, etc.).
 */
export function extractApiError(e: unknown, fallback = 'Error'): string {
  if (typeof e === 'object' && e !== null) {
    const err = e as { response?: { data?: { message?: string } } };
    return err.response?.data?.message ?? fallback;
  }
  return fallback;
}

/**
 * Uses the Web Share API when available (mobile, installed PWAs, some desktop browsers),
 * otherwise falls back to writing the URL to the clipboard.
 * Returns 'shared' / 'copied' / 'error' so the caller can display the right toast.
 */
export async function shareOrCopy(data: { title?: string; text?: string; url: string }): Promise<'shared' | 'copied' | 'error'> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (typeof nav.share === 'function') {
    try {
      await nav.share(data);
      return 'shared';
    } catch (e) {
      // User cancelled the share sheet — don't treat as error, just bail without the copy fallback.
      if (e instanceof Error && e.name === 'AbortError') return 'error';
      // Any other failure → fall through to clipboard.
    }
  }
  try {
    await navigator.clipboard.writeText(data.url);
    return 'copied';
  } catch {
    return 'error';
  }
}

import { TOKENS } from '@/theme/tokens';

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
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

export function categoryColor(category: string): string {
  const key = category as keyof typeof TOKENS.categories;
  return TOKENS.categories[key] ?? '#888';
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

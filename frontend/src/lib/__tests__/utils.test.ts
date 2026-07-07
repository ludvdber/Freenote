import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatNumber,
  formatDate,
  formatRelativeDate,
  categoryColor,
  extractApiError,
  shareOrCopy,
  isNewDoc,
  isHotDoc,
  daysUntil,
} from '../utils';

describe('daysUntil', () => {
  // Jours CALENDAIRES (minuit à minuit) : à 23 h, demain reste « dans 1 jour ».
  const now = new Date('2026-07-07T23:30:00');

  it('counts calendar days to a future date', () => {
    expect(daysUntil('2026-09-07', now)).toBe(62);
    expect(daysUntil('2026-07-08', now)).toBe(1);
  });

  it('returns 0 for today', () => {
    expect(daysUntil('2026-07-07', now)).toBe(0);
  });

  it('returns a negative number for a past date (banner auto-hidden)', () => {
    expect(daysUntil('2026-07-01', now)).toBe(-6);
  });
});

describe('formatNumber', () => {
  it('formats thousands and millions, leaves small numbers as-is', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1500)).toBe('1.5k');
    expect(formatNumber(2_500_000)).toBe('2.5M');
    expect(formatNumber(0)).toBe('0');
  });
});

describe('formatDate', () => {
  it('formats a date in fr-BE and en-GB', () => {
    expect(formatDate('2026-06-16', 'fr')).toMatch(/2026/);
    expect(formatDate('2026-06-16', 'en')).toMatch(/2026/);
  });
});

describe('formatRelativeDate', () => {
  const now = new Date('2026-06-16T12:00:00Z').getTime();

  afterEach(() => vi.useRealTimers());

  function at(iso: string, locale: string) {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    return formatRelativeDate(iso, locale);
  }

  it('returns "just now" under a minute', () => {
    expect(at('2026-06-16T11:59:30Z', 'fr')).toBe("À l'instant");
    expect(at('2026-06-16T11:59:30Z', 'en')).toBe('Just now');
  });

  it('returns minutes / hours / days', () => {
    expect(at('2026-06-16T11:30:00Z', 'fr')).toBe('Il y a 30min');
    expect(at('2026-06-16T11:30:00Z', 'en')).toBe('30min ago');
    expect(at('2026-06-16T09:00:00Z', 'fr')).toBe('Il y a 3h');
    expect(at('2026-06-16T09:00:00Z', 'en')).toBe('3h ago');
    expect(at('2026-06-14T12:00:00Z', 'fr')).toBe('Il y a 2j');
    expect(at('2026-06-14T12:00:00Z', 'en')).toBe('2d ago');
  });

  it('falls back to an absolute date beyond a week', () => {
    expect(at('2026-05-01T12:00:00Z', 'fr')).toMatch(/\d/);
  });
});

describe('isNewDoc / isHotDoc', () => {
  const now = new Date('2026-06-16T12:00:00Z');

  it('marks a doc "new" under 7 days, not beyond', () => {
    expect(isNewDoc('2026-06-14T12:00:00Z', now)).toBe(true);
    expect(isNewDoc('2026-06-01T12:00:00Z', now)).toBe(false);
  });

  it('marks a doc "hot" only with sustained views (≥2/day AND ≥20 total)', () => {
    // 30 days old, 100 views → 3.3/day
    expect(isHotDoc('2026-05-17T12:00:00Z', 100, now)).toBe(true);
    // 30 days old, 30 views → 1/day: below the pace threshold
    expect(isHotDoc('2026-05-17T12:00:00Z', 30, now)).toBe(false);
    // 2 days old, 10 views → 5/day but under the 20-view floor
    expect(isHotDoc('2026-06-14T12:00:00Z', 10, now)).toBe(false);
  });
});

describe('categoryColor', () => {
  it('returns a known category colour and a fallback for unknown', () => {
    expect(categoryColor('SYNTHESE')).toMatch(/^#/);
    expect(categoryColor('NOPE')).toBe('#888');
  });
});

describe('extractApiError', () => {
  it('reads the backend message and falls back otherwise', () => {
    expect(extractApiError({ response: { data: { message: 'Boom' } } })).toBe('Boom');
    expect(extractApiError({ response: { data: {} } }, 'fallback')).toBe('fallback');
    expect(extractApiError('a string', 'fallback')).toBe('fallback');
    expect(extractApiError(null, 'fb')).toBe('fb');
  });
});

describe('shareOrCopy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the Web Share API when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, clipboard: { writeText: vi.fn() } });
    expect(await shareOrCopy({ url: 'https://x' })).toBe('shared');
    expect(share).toHaveBeenCalled();
  });

  it('returns "error" when the user aborts the share sheet', async () => {
    const abort = Object.assign(new Error('x'), { name: 'AbortError' });
    const share = vi.fn().mockRejectedValue(abort);
    vi.stubGlobal('navigator', { share, clipboard: { writeText: vi.fn() } });
    expect(await shareOrCopy({ url: 'https://x' })).toBe('error');
  });

  it('falls back to clipboard when share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await shareOrCopy({ url: 'https://x' })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://x');
  });

  it('returns "error" when clipboard also fails', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) } });
    expect(await shareOrCopy({ url: 'https://x' })).toBe('error');
  });
});

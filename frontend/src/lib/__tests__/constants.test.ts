import { describe, it, expect } from 'vitest';
import * as c from '../constants';

describe('constants', () => {
  it('exposes the expected app constants', () => {
    expect(c.CATEGORIES).toContain('SYNTHESE');
    expect(c.CATEGORIES).toContain('TFE');
    expect(c.MAX_FILE_SIZE).toBe(7 * 1024 * 1024);
    expect(c.MAX_IMAGES).toBe(8);
    expect(c.IMAGE_MAX_SIZE).toBe(8 * 1024 * 1024);
    expect(c.ACCEPTED_IMAGE_TYPES).toEqual(['image/jpeg', 'image/png']);
    expect(c.STALE_15M).toBe(15 * 60 * 1000);
    expect(c.DISCORD_OAUTH_URL).toBe('/oauth2/authorization/discord');
  });

  it('normalises SITE_URL without a trailing slash', () => {
    expect(c.SITE_URL).toMatch(/^https?:\/\//);
    expect(c.SITE_URL.endsWith('/')).toBe(false);
  });

  it('exposes external links', () => {
    expect(c.KOFI_URL).toContain('ko-fi');
    expect(c.DISCORD_INVITE_URL).toContain('discord');
    expect(c.GITHUB_URL).toContain('github');
  });
});

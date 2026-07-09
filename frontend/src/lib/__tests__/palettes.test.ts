import { describe, it, expect } from 'vitest';
import { ACCENT_PALETTES, accentFor } from '../palettes';

describe('palettes', () => {
  it('has unique ids matching the backend whitelist', () => {
    const ids = ACCENT_PALETTES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    // ⚠️ Miroir du @Pattern backend (UpdateProfileRequest) — si ce test casse, synchroniser les deux.
    expect(ids).toEqual(['aurora', 'nebula', 'solar', 'ocean', 'ruby']);
  });

  it('provides both dark and light variants as hex colors', () => {
    for (const p of ACCENT_PALETTES) {
      expect(p.dark.primary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.dark.secondary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.light.primary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.light.secondary).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('accentFor resolves known ids and falls back to null otherwise', () => {
    expect(accentFor('aurora')?.dark.primary).toBe('#34d399');
    expect(accentFor('inconnue')).toBeNull();
    expect(accentFor(null)).toBeNull();
    expect(accentFor(undefined)).toBeNull();
  });
});

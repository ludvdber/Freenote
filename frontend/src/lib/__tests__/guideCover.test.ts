import { describe, it, expect } from 'vitest';
import { guideCover } from '../guideCover';

describe('guideCover', () => {
  it('gives known categories their dedicated emoji + tint (accent/case-insensitive)', () => {
    expect(guideCover('Java').emoji).toBe('☕');
    expect(guideCover('SQL').emoji).toBe('🗄️');
    expect(guideCover('Base de données').emoji).toBe('🗄️');
    expect(guideCover('Réseaux').emoji).toBe('🌐');
    expect(guideCover('reseaux').emoji).toBe('🌐'); // sans accent → même résultat
    expect(guideCover('Git').emoji).toBe('🌿');
    expect(guideCover('Logique').emoji).toBe('⚡');
  });

  it('is deterministic: same category always returns the same cover', () => {
    expect(guideCover('Astronomie')).toEqual(guideCover('Astronomie'));
    expect(guideCover('Java')).toEqual(guideCover('  java  ')); // trim + casse
  });

  it('falls back to 📖 + a hashed palette tint for an unknown category', () => {
    const c = guideCover('Astronomie');
    expect(c.emoji).toBe('📖');
    expect(c.gradient).toContain('linear-gradient');
    expect(c.color).toMatch(/^#/);
  });

  it('handles a missing category (guides without one stay presentable)', () => {
    expect(guideCover(null).emoji).toBe('📖');
    expect(guideCover(undefined).emoji).toBe('📖');
    expect(guideCover('   ').emoji).toBe('📖');
  });

  it('does not confuse Java with JavaScript', () => {
    expect(guideCover('JavaScript').emoji).toBe('🕸️');
  });
});

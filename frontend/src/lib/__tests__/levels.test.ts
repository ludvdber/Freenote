import { describe, it, expect } from 'vitest';
import { LEVELS, levelFor, nextLevel, levelProgress, levelColor } from '../levels';

describe('levels', () => {
  it('has 7 tiers ending with Galaxie at 3000 XP (product decision)', () => {
    expect(LEVELS).toHaveLength(7);
    expect(LEVELS[LEVELS.length - 1].key).toBe('galaxy');
    expect(LEVELS[LEVELS.length - 1].minXp).toBe(3000);
  });

  it('tiers are strictly ascending and start at 0', () => {
    expect(LEVELS[0].minXp).toBe(0);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].minXp).toBeGreaterThan(LEVELS[i - 1].minXp);
    }
  });

  it.each([
    [0, 'stardust'],
    [59, 'stardust'],
    [60, 'meteor'],
    [179, 'meteor'],
    [180, 'comet'],
    [360, 'star'],
    [719, 'star'],
    [720, 'supernova'],
    [1440, 'constellation'],
    [2999, 'constellation'],
    [3000, 'galaxy'],
    [99999, 'galaxy'],
  ])('levelFor(%i) → %s', (xp, key) => {
    expect(levelFor(xp).key).toBe(key);
  });

  it('clamps negative or invalid XP to the first tier', () => {
    expect(levelFor(-50).key).toBe('stardust');
    expect(levelFor(Number.NaN).key).toBe('stardust');
  });

  it('nextLevel points to the following tier and null at the top', () => {
    expect(nextLevel(0)?.key).toBe('meteor');
    expect(nextLevel(720)?.key).toBe('constellation');
    expect(nextLevel(3000)).toBeNull();
  });

  it('levelProgress computes ratio and remaining within the tier', () => {
    const p = levelProgress(390); // star: 360 → supernova 720, span 360, 30 in
    expect(p.current.key).toBe('star');
    expect(p.next?.key).toBe('supernova');
    expect(p.ratio).toBeCloseTo(30 / 360);
    expect(p.remaining).toBe(330);
  });

  it('levelProgress saturates at the top tier', () => {
    const p = levelProgress(5000);
    expect(p.current.key).toBe('galaxy');
    expect(p.next).toBeNull();
    expect(p.ratio).toBe(1);
    expect(p.remaining).toBe(0);
  });

  it('levelColor picks the mode-specific variant', () => {
    const star = levelFor(400);
    expect(levelColor(star, 'dark')).toBe('#ffd93d');
    expect(levelColor(star, 'light')).toBe('#ca8a04');
  });

  it('only the top tier carries a gradient', () => {
    expect(LEVELS.filter((l) => l.gradient)).toHaveLength(1);
    expect(LEVELS[LEVELS.length - 1].gradient).toContain('linear-gradient');
  });
});

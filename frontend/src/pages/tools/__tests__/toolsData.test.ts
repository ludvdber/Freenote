import { describe, it, expect } from 'vitest';
import { TOOLS, TOOL_CATEGORIES, toolBySlug } from '../toolsData';

describe('tools registry', () => {
  it('exposes the tools with unique slugs and i18n keys', () => {
    expect(TOOLS).toHaveLength(11);

    const slugs = TOOLS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toEqual(
      expect.arrayContaining([
        'flashcards', 'quiz', 'calculateur-moyenne', 'diagramme-uml', 'gantt', 'calculateur-ip',
        'calculateur-ipv6', 'table-de-verite', 'convertisseur-bases', 'base64', 'jwt',
      ]),
    );

    const keys = TOOLS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every tool has an icon and a lazy component', () => {
    for (const tool of TOOLS) {
      expect(tool.icon).toBeTruthy();
      expect(tool.Component).toBeTruthy();
    }
  });

  it('every tool has a category belonging to the known set', () => {
    for (const tool of TOOLS) {
      expect(TOOL_CATEGORIES).toContain(tool.category);
    }
  });

  it('exposes the two flagship study tools as large bento tiles', () => {
    expect(toolBySlug('flashcards')?.size).toBe('lg');
    expect(toolBySlug('quiz')?.size).toBe('lg');
  });

  it('toolBySlug resolves a known slug and returns undefined otherwise', () => {
    expect(toolBySlug('jwt')?.key).toBe('jwt');
    expect(toolBySlug('calculateur-moyenne')?.key).toBe('grade');
    expect(toolBySlug('does-not-exist')).toBeUndefined();
    expect(toolBySlug(undefined)).toBeUndefined();
  });
});

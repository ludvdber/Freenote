import { describe, it, expect } from 'vitest';
import { sectionCounts, filterByScope, groupByCourse, groupBySection, matchesQuery } from '../lib';

const item = (sectionId: number | null, sectionName: string | null, courseId: number | null, courseName: string | null, title = 'x') =>
  ({ sectionId, sectionName, courseId, courseName, title });

const SAMPLE = [
  item(4, 'Informatique', 9, 'Java'),
  item(4, 'Informatique', 9, 'Java'),
  item(4, 'Informatique', 12, 'Réseaux'),
  item(4, 'Informatique', null, null),      // multi-cours « toute la section »
  item(6, 'Marketing', 20, 'Communication'),
  item(null, null, null, null),             // sans section
];

describe('sectionCounts', () => {
  it('counts per section, biggest first, « sans section » always last', () => {
    const counts = sectionCounts(SAMPLE);
    expect(counts.map((c) => [c.id, c.count])).toEqual([[4, 4], [6, 1], [null, 1]]);
    expect(counts[0].name).toBe('Informatique');
  });
});

describe('filterByScope', () => {
  it('keeps everything for "all", one section for an id, orphans for "none"', () => {
    expect(filterByScope(SAMPLE, 'all')).toHaveLength(6);
    expect(filterByScope(SAMPLE, 4)).toHaveLength(4);
    expect(filterByScope(SAMPLE, 'none')).toHaveLength(1);
  });
});

describe('groupByCourse', () => {
  it('puts the multi-course group (courseId null) FIRST, then courses alphabetically', () => {
    const groups = groupByCourse(filterByScope(SAMPLE, 4));
    expect(groups.map((g) => g.courseName)).toEqual([null, 'Java', 'Réseaux']);
    expect(groups[1].items).toHaveLength(2);
  });
});

describe('groupBySection', () => {
  it('groups the "Tout" view by section, biggest first, orphans last', () => {
    const groups = groupBySection(SAMPLE);
    expect(groups.map((g) => g.sectionName)).toEqual(['Informatique', 'Marketing', null]);
  });
});

describe('matchesQuery', () => {
  it('is accent- and case-insensitive, and empty query matches everything', () => {
    expect(matchesQuery('Révision générale', 'revision')).toBe(true);
    expect(matchesQuery('Réseaux', 'RESEAUX')).toBe(true);
    expect(matchesQuery('Java', 'sql')).toBe(false);
    expect(matchesQuery('Java', '  ')).toBe(true);
  });
});

// Cas réel : « Statistiques » lié entre Informatique (4) et Marketing (6), quiz déposé côté Informatique.
describe('équivalences de cours', () => {
  const statsQuiz = {
    ...item(4, 'Informatique', 30, 'Statistiques', 'Quiz stats'),
    linkedCourses: [{ courseId: 31, courseName: 'Statistiques', sectionId: 6, sectionName: 'Marketing' }],
  };
  const items = [statsQuiz, item(6, 'Marketing', 20, 'Communication', 'Quiz com')];

  it('range le quiz aussi sous la section liée, présenté sous le cours équivalent', () => {
    const marketing = filterByScope(items, 6);
    expect(marketing.map((i) => i.title)).toEqual(['Quiz stats', 'Quiz com']);
    expect(marketing[0]).toMatchObject({ sectionId: 6, courseId: 31, courseName: 'Statistiques' });
    expect(groupByCourse(marketing).map((g) => g.courseName)).toEqual(['Communication', 'Statistiques']);
  });

  it('compte le quiz dans la chip de la section liée', () => {
    expect(sectionCounts(items)).toEqual(
      expect.arrayContaining([
        { id: 4, name: 'Informatique', count: 1 },
        { id: 6, name: 'Marketing', count: 2 },
      ]),
    );
  });

  it('ne le duplique pas dans la vue « Tout »', () => {
    expect(filterByScope(items, 'all')).toHaveLength(2);
    expect(groupBySection(filterByScope(items, 'all')).map((g) => g.items.length)).toEqual([1, 1]);
  });

  it('garde sa présentation propre dans sa section d\'origine', () => {
    expect(filterByScope(items, 4)).toEqual([statsQuiz]);
  });
});

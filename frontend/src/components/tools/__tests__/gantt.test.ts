import { describe, it, expect } from 'vitest';
import {
  validateProject, normalizeProject, renderTasks,
  projectToJson, projectFromJson, toCsv, addDaysIso, type GanttProject,
} from '../gantt/logic';

const NOW = 1_700_000_000_000;

function project(overrides: Partial<GanttProject> = {}): GanttProject {
  return {
    id: 'p1',
    title: 'Projet TFE',
    createdAt: NOW,
    tasks: [
      { id: 'a', name: 'Analyse', start: '2026-09-01', end: '2026-09-07', progress: 50, dependencies: '' },
      { id: 'b', name: 'Dev', start: '2026-09-08', end: '2026-09-20', progress: 0, dependencies: 'a' },
    ],
    ...overrides,
  };
}

describe('gantt — dates', () => {
  it('adds days across month boundaries', () => {
    expect(addDaysIso('2026-09-30', 1)).toBe('2026-10-01');
  });
});

describe('gantt — validation', () => {
  it('accepts a well-formed project', () => {
    expect(validateProject(project())).toBeNull();
  });
  it('rejects a blank title or no named task', () => {
    expect(validateProject(project({ title: '  ' }))).toBe('errTitle');
    expect(validateProject(project({ tasks: [{ id: 'a', name: '', start: '', end: '', progress: 0, dependencies: '' }] }))).toBe('errNoTasks');
  });
});

describe('gantt — normalize & render', () => {
  it('drops nameless tasks and clamps progress', () => {
    const n = normalizeProject(project({
      tasks: [
        { id: 'a', name: '  Tâche  ', start: '2026-09-01', end: '2026-09-05', progress: 150, dependencies: '' },
        { id: 'b', name: '   ', start: '', end: '', progress: 0, dependencies: '' },
      ],
    }));
    expect(n.tasks).toHaveLength(1);
    expect(n.tasks[0].name).toBe('Tâche');
    expect(n.tasks[0].progress).toBe(100);
  });

  it('fills missing dates and prunes unknown dependencies', () => {
    const r = renderTasks(project({
      tasks: [
        { id: 'a', name: 'A', start: '', end: '', progress: 0, dependencies: '' },
        { id: 'b', name: 'B', start: '2026-09-08', end: '2026-09-01', progress: 0, dependencies: 'a, ghost' },
      ],
    }));
    expect(r[0].start).toBeTruthy();
    expect(r[0].end >= r[0].start).toBe(true);
    expect(r[1].end).toBe(r[1].start); // end<start was clamped up to start
    expect(r[1].dependencies).toBe('a'); // 'ghost' pruned
  });
});

describe('gantt — backup', () => {
  it('round-trips through JSON (dropping account fields) and heals garbage', () => {
    const restored = projectFromJson(projectToJson(project({ serverId: 9, shared: true })));
    expect(restored.title).toBe('Projet TFE');
    expect(restored.serverId).toBeUndefined();
    expect(restored.tasks[1].dependencies).toBe('a');
    expect(() => projectFromJson('nope')).toThrow();
  });

  it('exports CSV with a header and one row per task', () => {
    const csv = toCsv(project());
    const lines = csv.split('\n');
    expect(lines[0]).toBe('id,name,start,end,progress,dependencies');
    expect(lines).toHaveLength(3);
  });
});

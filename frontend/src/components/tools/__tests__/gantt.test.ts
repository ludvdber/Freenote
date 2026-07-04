import { describe, it, expect } from 'vitest';
import {
  validateProject, normalizeProject, renderTasks, clampIsoDate,
  projectToJson, projectFromJson, toCsv, addDaysIso, diffDays, projectRange, workerColor,
  WORKER_COLORS, UNASSIGNED_COLOR, type GanttProject,
} from '../gantt/logic';

const NOW = 1_700_000_000_000;

function project(overrides: Partial<GanttProject> = {}): GanttProject {
  return {
    id: 'p1',
    title: 'Projet TFE',
    createdAt: NOW,
    workers: ['Alice', 'Bob'],
    tasks: [
      { id: 'a', name: 'Analyse', start: '2026-09-01', end: '2026-09-07', progress: 50, dependencies: '', assignee: 'Alice' },
      { id: 'b', name: 'Dev', start: '2026-09-08', end: '2026-09-20', progress: 0, dependencies: 'a' },
    ],
    ...overrides,
  };
}

describe('gantt — dates', () => {
  it('adds days across month boundaries', () => {
    expect(addDaysIso('2026-09-30', 1)).toBe('2026-10-01');
  });
  it('computes whole-day differences', () => {
    expect(diffDays('2026-09-01', '2026-09-08')).toBe(7);
    expect(diffDays('2026-09-08', '2026-09-01')).toBe(-7);
    expect(diffDays('2026-09-01', '2026-09-01')).toBe(0);
  });
  it('spans the padded project range across all tasks', () => {
    const r = projectRange(renderTasks(project()), 2);
    expect(r.start).toBe('2026-08-30'); // 09-01 − 2 j
    expect(r.end).toBe('2026-09-22');   // 09-20 + 2 j
  });
});

describe('gantt — workers', () => {
  it('colors a worker by its index and grays the unassigned', () => {
    expect(workerColor(['Alice', 'Bob'], 'Alice')).toBe(WORKER_COLORS[0]);
    expect(workerColor(['Alice', 'Bob'], 'Bob')).toBe(WORKER_COLORS[1]);
    expect(workerColor(['Alice'], undefined)).toBe(UNASSIGNED_COLOR);
    expect(workerColor(['Alice'], 'Zoé')).toBe(UNASSIGNED_COLOR); // inconnu → neutre
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

describe('gantt — date clamp (crash guard)', () => {
  it('clamps an out-of-range year to the sane window', () => {
    // A half-typed year in <input type="date"> emits e.g. year 0002; without clamping the timeline
    // would span ~2000 years (a giant SVG that freezes the tab).
    expect(clampIsoDate('0002-09-01')).toBe('1970-01-01');
    expect(clampIsoDate('9999-01-01')).toBe('2100-12-31');
    expect(clampIsoDate('2026-09-01')).toBe('2026-09-01'); // in-range untouched
    expect(clampIsoDate('not-a-date')).toMatch(/^\d{4}-\d{2}-\d{2}$/); // falls back to today
  });

  it('renderTasks keeps the project span bounded even with an aberrant date', () => {
    const r = renderTasks(project({
      tasks: [{ id: 'a', name: 'A', start: '0002-09-01', end: '0002-09-05', progress: 0, dependencies: '' }],
    }));
    expect(r[0].start >= '1970-01-01').toBe(true);
    const range = projectRange(r);
    expect(diffDays(range.start, range.end)).toBeLessThan(366 * 200);
  });
});

describe('gantt — backup', () => {
  it('round-trips through JSON (dropping account fields) and heals garbage', () => {
    const restored = projectFromJson(projectToJson(project({ serverId: 9, shared: true })));
    expect(restored.title).toBe('Projet TFE');
    expect(restored.serverId).toBeUndefined();
    expect(restored.tasks[1].dependencies).toBe('a');
    expect(restored.tasks[0].assignee).toBe('Alice');
    expect(restored.workers).toEqual(['Alice', 'Bob']);
    expect(() => projectFromJson('nope')).toThrow();
  });

  it('rebuilds the workers list from assignees for v1 backups without the field', () => {
    const v1 = JSON.stringify({
      version: 1,
      project: {
        id: 'p1', title: 'Vieux backup', createdAt: NOW,
        tasks: [{ id: 'a', name: 'A', start: '2026-09-01', end: '2026-09-02', progress: 0, dependencies: '', assignee: 'Chloé' }],
      },
    });
    expect(projectFromJson(v1).workers).toEqual(['Chloé']);
  });

  it('exports CSV with a header and one row per task', () => {
    const csv = toCsv(project());
    const lines = csv.split('\n');
    expect(lines[0]).toBe('id,name,start,end,progress,dependencies,assignee');
    expect(lines).toHaveLength(3);
    expect(lines[1].endsWith(',Alice')).toBe(true);
  });
});

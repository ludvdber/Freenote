/**
 * Pure, framework-free logic for the Gantt tool: data model, date helpers, validation, CSV/JSON
 * (de)serialisation and the conversion to frappe-gantt's render shape. Deterministic + side-effect
 * free → unit-tested in isolation; the React component only wires it to state, the renderer and the API.
 */

export interface GanttTask {
  id: string;
  name: string;
  /** ISO date YYYY-MM-DD. */
  start: string;
  end: string;
  /** 0–100. */
  progress: number;
  /** Comma-separated task ids this task depends on. */
  dependencies: string;
}

export interface GanttProject {
  id: string;
  title: string;
  tasks: GanttTask[];
  createdAt: number;
  /** Backend id once saved to the account (absent = local-only). */
  serverId?: number;
  shared?: boolean;
}

/** frappe-gantt's expected task shape. */
export interface RenderTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  dependencies: string;
}

export function uid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function newTask(start?: string): GanttTask {
  const s = start ?? todayIso();
  return { id: uid(), name: '', start: s, end: addDaysIso(s, 3), progress: 0, dependencies: '' };
}

export function newProject(title: string, now: number = Date.now()): GanttProject {
  return { id: uid(), title: title.trim() || 'Projet', tasks: [newTask()], createdAt: now };
}

/** i18n error key if the project can't be saved/shared, else null. */
export function validateProject(p: GanttProject): string | null {
  if (!p.title.trim()) return 'errTitle';
  if (p.tasks.filter((t) => t.name.trim()).length === 0) return 'errNoTasks';
  return null;
}

/** Trim, clamp progress, drop nameless tasks, and ensure end ≥ start. */
export function normalizeProject(p: GanttProject): GanttProject {
  const tasks = p.tasks
    .filter((t) => t.name.trim())
    .map((t) => {
      const start = t.start || todayIso();
      let end = t.end || addDaysIso(start, 3);
      if (end < start) end = start;
      return {
        ...t,
        name: t.name.trim(),
        start,
        end,
        progress: Math.max(0, Math.min(100, Math.round(t.progress) || 0)),
        dependencies: t.dependencies.trim(),
      };
    });
  return { ...p, title: p.title.trim() || 'Projet', tasks };
}

/** frappe-gantt-ready tasks: valid dates guaranteed, dependencies pruned to existing ids. */
export function renderTasks(p: GanttProject): RenderTask[] {
  const norm = normalizeProject(p);
  const ids = new Set(norm.tasks.map((t) => t.id));
  return norm.tasks.map((t) => ({
    id: t.id,
    name: t.name,
    start: t.start,
    end: t.end,
    progress: t.progress,
    dependencies: t.dependencies
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d && ids.has(d))
      .join(','),
  }));
}

// ── JSON backup ──────────────────────────────────────────────────
export function projectToJson(p: GanttProject): string {
  return JSON.stringify({ version: 1, project: stripServer(p) });
}

function stripServer(p: GanttProject): GanttProject {
  // Exported backups are portable — drop the account-bound fields.
  const { serverId: _s, shared: _sh, ...rest } = p;
  void _s; void _sh;
  return rest;
}

export function projectFromJson(text: string, now: number = Date.now()): GanttProject {
  const parsed: unknown = JSON.parse(text);
  const raw = (parsed as { project?: unknown })?.project ?? parsed;
  return healProject(raw, now);
}

function healProject(input: unknown, now: number): GanttProject {
  const p = input as Partial<GanttProject> & { tasks?: unknown };
  if (typeof p.title !== 'string' || !Array.isArray(p.tasks)) throw new Error('Invalid Gantt project');
  return {
    id: typeof p.id === 'string' ? p.id : uid(),
    title: p.title,
    createdAt: Number.isFinite(p.createdAt) ? (p.createdAt as number) : now,
    tasks: p.tasks.map(healTask),
  };
}

function healTask(input: unknown): GanttTask {
  const t = input as Partial<GanttTask>;
  const start = typeof t.start === 'string' && t.start ? t.start : todayIso();
  return {
    id: typeof t.id === 'string' && t.id ? t.id : uid(),
    name: typeof t.name === 'string' ? t.name : '',
    start,
    end: typeof t.end === 'string' && t.end ? t.end : addDaysIso(start, 3),
    progress: typeof t.progress === 'number' ? Math.max(0, Math.min(100, t.progress)) : 0,
    dependencies: typeof t.dependencies === 'string' ? t.dependencies : '',
  };
}

// ── CSV export ───────────────────────────────────────────────────
const CSV_HEADER = 'id,name,start,end,progress,dependencies';

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(p: GanttProject): string {
  const rows = normalizeProject(p).tasks.map((t) =>
    [t.id, t.name, t.start, t.end, String(t.progress), t.dependencies].map(csvCell).join(','),
  );
  return [CSV_HEADER, ...rows].join('\n');
}

/**
 * Pure, framework-free logic for the Gantt tool: data model, date helpers, validation, CSV/JSON
 * (de)serialisation and the cleaned render shape consumed by the custom Timeline. Deterministic +
 * side-effect free → unit-tested in isolation; the React component only wires it to state, the
 * renderer and the API.
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
  /** Nom du travailleur assigné (doit exister dans project.workers pour être coloré). */
  assignee?: string;
}

export interface GanttProject {
  id: string;
  title: string;
  tasks: GanttTask[];
  /** Travailleurs du projet — l'ordre détermine la couleur des barres. */
  workers: string[];
  createdAt: number;
  /** Backend id once saved to the account (absent = local-only). */
  serverId?: number;
  shared?: boolean;
}

/** Cleaned task shape for the Timeline renderer (valid dates, deps pruned to existing ids). */
export interface RenderTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  dependencies: string;
  assignee?: string;
}

/** Palette des travailleurs (couleur = index dans project.workers, cyclique).
 *  Alignée sur l'identité du site (violet→cyan) + teintes distinctes et lisibles en dark. */
export const WORKER_COLORS = [
  '#00d2ff', // cyan (marque)
  '#7b2ff7', // violet (marque)
  '#ffb020', // ambre
  '#2ecc71', // vert
  '#ff6b81', // corail
  '#f1c40f', // jaune
  '#9b59b6', // améthyste
  '#1abc9c', // turquoise
] as const;

/** Couleur de la barre : gris neutre sans assigné, sinon la couleur stable du travailleur. */
export const UNASSIGNED_COLOR = '#8899aa';

export function workerColor(workers: string[], assignee?: string): string {
  if (!assignee) return UNASSIGNED_COLOR;
  const i = workers.indexOf(assignee);
  return i === -1 ? UNASSIGNED_COLOR : WORKER_COLORS[i % WORKER_COLORS.length];
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

/** Fenêtre d'années raisonnable pour la timeline. Un `<input type="date">` émet la valeur à
 *  CHAQUE frappe : taper « 2 » pour « 2025 » produit d'abord l'an 0002, ce qui ferait couvrir
 *  ~2000 ans à la timeline (SVG géant → l'onglet gèle). On borne donc les dates aberrantes. */
export const MIN_GANTT_YEAR = 1970;
export const MAX_GANTT_YEAR = 2100;

export function clampIsoDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return todayIso();
  const y = d.getUTCFullYear();
  if (y < MIN_GANTT_YEAR) return `${MIN_GANTT_YEAR}-01-01`;
  if (y > MAX_GANTT_YEAR) return `${MAX_GANTT_YEAR}-12-31`;
  return iso;
}

/** Whole days from a to b (b − a) — 0 for the same day, negative if b precedes a. */
export function diffDays(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T00:00:00Z`).getTime();
  const b = new Date(`${bIso}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Inclusive date range spanned by the tasks, padded for breathing room on both sides.
 *  Falls back to today+30d when no task has valid dates. */
export function projectRange(tasks: RenderTask[], padDays = 2): { start: string; end: string } {
  let min: string | null = null;
  let max: string | null = null;
  for (const t of tasks) {
    if (!min || t.start < min) min = t.start;
    if (!max || t.end > max) max = t.end;
  }
  const start = min ?? todayIso();
  const end = max ?? addDaysIso(start, 30);
  return { start: addDaysIso(start, -padDays), end: addDaysIso(end, padDays) };
}

export function newTask(start?: string): GanttTask {
  const s = start ?? todayIso();
  return { id: uid(), name: '', start: s, end: addDaysIso(s, 3), progress: 0, dependencies: '' };
}

export function newProject(title: string, now: number = Date.now()): GanttProject {
  return { id: uid(), title: title.trim() || 'Projet', tasks: [newTask()], workers: [], createdAt: now };
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
        assignee: t.assignee?.trim() || undefined,
      };
    });
  return { ...p, title: p.title.trim() || 'Projet', tasks };
}

/** Timeline-ready tasks: valid dates guaranteed AND clamped to a sane year window (so a
 *  half-typed year can't blow up the renderer), dependencies pruned to existing ids. */
export function renderTasks(p: GanttProject): RenderTask[] {
  const norm = normalizeProject(p);
  const ids = new Set(norm.tasks.map((t) => t.id));
  return norm.tasks.map((t) => {
    const start = clampIsoDate(t.start);
    let end = clampIsoDate(t.end);
    if (end < start) end = start;
    return {
      id: t.id,
      name: t.name,
      start,
      end,
      progress: t.progress,
      dependencies: t.dependencies
        .split(',')
        .map((d) => d.trim())
        .filter((d) => d && ids.has(d))
        .join(','),
      assignee: t.assignee,
    };
  });
}

// ── JSON backup ──────────────────────────────────────────────────
export function projectToJson(p: GanttProject): string {
  return JSON.stringify({ version: 2, project: stripServer(p) });
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
  const tasks = p.tasks.map(healTask);
  return {
    id: typeof p.id === 'string' ? p.id : uid(),
    title: p.title,
    createdAt: Number.isFinite(p.createdAt) ? (p.createdAt as number) : now,
    tasks,
    workers: healWorkers(p.workers, tasks),
  };
}

/** Workers list: strings only, de-duplicated; v1 backups without the field get the list
 *  rebuilt from the assignees found on the tasks (so nothing loses its colour). */
function healWorkers(input: unknown, tasks: GanttTask[]): string[] {
  const fromInput = Array.isArray(input)
    ? input.filter((w): w is string => typeof w === 'string' && w.trim() !== '').map((w) => w.trim())
    : [];
  const fromTasks = tasks.map((t) => t.assignee).filter((a): a is string => Boolean(a));
  return [...new Set([...fromInput, ...fromTasks])];
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
    assignee: typeof t.assignee === 'string' && t.assignee.trim() ? t.assignee.trim() : undefined,
  };
}

// ── CSV export ───────────────────────────────────────────────────
const CSV_HEADER = 'id,name,start,end,progress,dependencies,assignee';

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(p: GanttProject): string {
  const rows = normalizeProject(p).tasks.map((t) =>
    [t.id, t.name, t.start, t.end, String(t.progress), t.dependencies, t.assignee ?? ''].map(csvCell).join(','),
  );
  return [CSV_HEADER, ...rows].join('\n');
}

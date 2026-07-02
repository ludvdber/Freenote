import { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, TextField, IconButton, Button, Chip, Stack, Tabs, Tab, Tooltip,
  ToggleButtonGroup, ToggleButton, Select, MenuItem, FormControl, InputLabel,
  Snackbar, Alert, CircularProgress, OutlinedInput,
} from '@mui/material';
import {
  Add, DeleteOutlined, FileDownload, FileUpload, Image as ImageIcon, Save, CloudUpload,
  CloudDownload, Check,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/useAuthStore';
import GlassCard from '@/components/ui/GlassCard';
import {
  listMyGanttCharts, listSharedGanttCharts, getGanttChart, createGanttChart, updateGanttChart, deleteGanttChart,
} from '@/api/endpoints';
import type { GanttSummary, GanttTaskDto } from '@/types';
import {
  type GanttProject, type GanttTask,
  newProject, newTask, validateProject, normalizeProject, renderTasks, projectToJson, projectFromJson, toCsv,
} from './gantt/logic';

const STORAGE_KEY = 'freenote.gantt.v1';
type ViewMode = 'Day' | 'Week' | 'Month';
type Feedback = { msg: string; severity: 'success' | 'error' };

function loadDraft(): GanttProject {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return projectFromJson(raw);
  } catch { /* fall through to a fresh project */ }
  return newProject('Mon projet');
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function GanttChart() {
  const { t } = useTranslation();
  const { isVerified } = useAuthStore();
  const [project, setProject] = useState<GanttProject>(loadDraft);
  const [tab, setTab] = useState<'editor' | 'mine' | 'library'>('editor');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const jsonInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, projectToJson(project));
  }, [project]);

  const patch = (p: Partial<GanttProject>) => setProject((prev) => ({ ...prev, ...p }));
  const setTask = (id: string, fn: (task: GanttTask) => GanttTask) =>
    setProject((prev) => ({ ...prev, tasks: prev.tasks.map((task) => (task.id === id ? fn(task) : task)) }));
  const addTask = () => setProject((prev) => {
    const lastEnd = prev.tasks.at(-1)?.end;
    return { ...prev, tasks: [...prev.tasks, newTask(lastEnd)] };
  });
  const removeTask = (id: string) => setProject((prev) => ({ ...prev, tasks: prev.tasks.filter((task) => task.id !== id) }));

  const exportJson = () => download(`${project.title || 'gantt'}.json`, projectToJson(project), 'application/json');
  const exportCsv = () => download(`${project.title || 'gantt'}.csv`, toCsv(project), 'text/csv');
  const importJson = async (file: File) => {
    try { setProject({ ...projectFromJson(await file.text()), serverId: undefined, shared: false }); setTab('editor'); }
    catch { setFeedback({ msg: t('tools.gantt.importError'), severity: 'error' }); }
  };

  const toDto = (task: GanttTask): GanttTaskDto => ({ ...task });
  const save = async (share: boolean) => {
    const err = validateProject(project);
    if (err) { setFeedback({ msg: t(`tools.gantt.${err}`), severity: 'error' }); return; }
    const n = normalizeProject(project);
    const body = { title: n.title, tasks: n.tasks.map(toDto), shared: share || Boolean(project.shared) };
    try {
      const res = project.serverId ? await updateGanttChart(project.serverId, body) : await createGanttChart(body);
      patch({ serverId: res.id, shared: res.shared });
      setFeedback({ msg: t(share ? 'tools.gantt.sharedOk' : 'tools.gantt.savedOk'), severity: 'success' });
    } catch {
      setFeedback({ msg: t('tools.gantt.saveError'), severity: 'error' });
    }
  };

  const loadFromServer = async (id: number, asCopy: boolean) => {
    try {
      const res = await getGanttChart(id);
      setProject({
        id: crypto.randomUUID?.() ?? String(Date.now()),
        title: asCopy ? `${res.title} (copie)` : res.title,
        createdAt: Date.now(),
        tasks: res.tasks.map((task) => ({ ...task })),
        serverId: asCopy ? undefined : res.id,
        shared: asCopy ? false : res.shared,
      });
      setTab('editor');
    } catch {
      setFeedback({ msg: t('tools.gantt.loadError'), severity: 'error' });
    }
  };

  return (
    <Box>
      <input ref={jsonInput} type="file" accept=".json" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2.5 }}>
        <Tab value="editor" label={t('tools.gantt.tabEditor')} />
        <Tab value="mine" label={t('tools.gantt.tabMine')} />
        <Tab value="library" label={t('tools.gantt.tabLibrary')} />
      </Tabs>

      {tab === 'editor' && (
        <Editor
          project={project} isVerified={isVerified}
          onTitle={(title) => patch({ title })}
          onAddTask={addTask} onSetTask={setTask} onRemoveTask={removeTask}
          onExportJson={exportJson} onExportCsv={exportCsv} onImport={() => jsonInput.current?.click()}
          onSave={() => save(false)} onShare={() => save(true)}
        />
      )}
      {tab === 'mine' && (
        <MyProjects isVerified={isVerified} onOpen={(id) => loadFromServer(id, false)}
          onFeedback={setFeedback} />
      )}
      {tab === 'library' && (
        <Library isVerified={isVerified} onImport={(id) => loadFromServer(id, true)} />
      )}

      <Snackbar open={feedback !== null} autoHideDuration={4000} onClose={() => setFeedback(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {feedback ? <Alert severity={feedback.severity} variant="filled" onClose={() => setFeedback(null)}>{feedback.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}

function Editor({ project, isVerified, onTitle, onAddTask, onSetTask, onRemoveTask, onExportJson, onExportCsv, onImport, onSave, onShare }: {
  project: GanttProject; isVerified: boolean;
  onTitle: (v: string) => void; onAddTask: () => void;
  onSetTask: (id: string, fn: (t: GanttTask) => GanttTask) => void; onRemoveTask: (id: string) => void;
  onExportJson: () => void; onExportCsv: () => void; onImport: () => void; onSave: () => void; onShare: () => void;
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<ViewMode>('Week');
  const ganttRef = useRef<HTMLDivElement>(null);

  // Render (debounced) with the lazily-loaded frappe-gantt; readonly = the table is the editor.
  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      const tasks = renderTasks(project);
      const el = ganttRef.current;
      if (!el) return;
      if (tasks.length === 0) { el.innerHTML = ''; return; }
      const Gantt = (await import('frappe-gantt')).default;
      // Vendored copy of the frappe-gantt stylesheet — the package's `exports` field doesn't expose
      // the CSS subpath to bundlers, so it lives in-repo (re-copy from dist/ on a frappe-gantt bump).
      await import('./gantt/frappe-gantt.css');
      if (cancelled || !ganttRef.current) return;
      ganttRef.current.innerHTML = '';
      new Gantt(ganttRef.current, tasks, { view_mode: view, readonly: true, bar_height: 22, column_width: 32 });
    }, 250);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [project, view]);

  const exportPng = () => {
    const svg = ganttRef.current?.querySelector('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const data = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml' }));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(rect.width));
      canvas.height = Math.max(1, Math.round(rect.height));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => { if (blob) triggerBlob(blob, `${project.title || 'gantt'}.png`); });
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  const namedTasks = project.tasks.filter((task) => task.name.trim());

  return (
    <Box>
      <TextField
        fullWidth label={t('tools.gantt.projectTitle')} value={project.title}
        onChange={(e) => onTitle(e.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} sx={{ mb: 2 }}
      />

      <Stack spacing={1.25} sx={{ mb: 2 }}>
        {project.tasks.map((task, i) => (
          <TaskRow
            key={task.id} task={task} index={i} others={namedTasks.filter((o) => o.id !== task.id)}
            onChange={(fn) => onSetTask(task.id, fn)} onRemove={() => onRemoveTask(task.id)}
            canRemove={project.tasks.length > 1}
          />
        ))}
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>
        <Button startIcon={<Add />} variant="outlined" onClick={onAddTask}>{t('tools.gantt.addTask')}</Button>
        <Box sx={{ flexGrow: 1 }} />
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>
          <ToggleButton value="Day">{t('tools.gantt.viewDay')}</ToggleButton>
          <ToggleButton value="Week">{t('tools.gantt.viewWeek')}</ToggleButton>
          <ToggleButton value="Month">{t('tools.gantt.viewMonth')}</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <GlassCard sx={{ p: 1.5, mb: 2, overflow: 'auto' }}>
        <Box ref={ganttRef} className="gantt-host" sx={{ minHeight: 160 }} />
      </GlassCard>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        <Button size="small" startIcon={<FileDownload />} onClick={onExportJson}>JSON</Button>
        <Button size="small" startIcon={<FileDownload />} onClick={onExportCsv}>CSV</Button>
        <Button size="small" startIcon={<ImageIcon />} onClick={exportPng}>PNG</Button>
        <Button size="small" startIcon={<FileUpload />} onClick={onImport}>{t('tools.gantt.import')}</Button>
        <Box sx={{ flexGrow: 1 }} />
        {isVerified ? (
          <>
            <Button variant="outlined" startIcon={<Save />} onClick={onSave}>{t('tools.gantt.save')}</Button>
            <Button variant="contained" color="success" startIcon={<CloudUpload />} onClick={onShare}>{t('tools.gantt.share')}</Button>
          </>
        ) : (
          <Typography variant="caption" color="text.secondary">{t('tools.gantt.loginToSave')}</Typography>
        )}
      </Box>
    </Box>
  );
}

function TaskRow({ task, index, others, onChange, onRemove, canRemove }: {
  task: GanttTask; index: number; others: GanttTask[];
  onChange: (fn: (t: GanttTask) => GanttTask) => void; onRemove: () => void; canRemove: boolean;
}) {
  const { t } = useTranslation();
  const deps = task.dependencies.split(',').map((d) => d.trim()).filter(Boolean);
  return (
    <GlassCard sx={{ p: 1.25, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      <Typography className="mono" sx={{ width: 22, textAlign: 'center', color: 'text.secondary' }}>{index + 1}</Typography>
      <TextField size="small" label={t('tools.gantt.taskName')} value={task.name}
        onChange={(e) => onChange((x) => ({ ...x, name: e.target.value }))}
        sx={{ flex: '2 1 160px' }} slotProps={{ htmlInput: { maxLength: 200 } }} />
      <TextField size="small" type="date" label={t('tools.gantt.start')} value={task.start}
        onChange={(e) => onChange((x) => ({ ...x, start: e.target.value }))}
        sx={{ width: 150 }} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField size="small" type="date" label={t('tools.gantt.end')} value={task.end}
        onChange={(e) => onChange((x) => ({ ...x, end: e.target.value }))}
        sx={{ width: 150 }} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField size="small" type="number" label="%" value={task.progress}
        onChange={(e) => onChange((x) => ({ ...x, progress: Number(e.target.value) }))}
        sx={{ width: 80 }} slotProps={{ htmlInput: { min: 0, max: 100 } }} />
      <FormControl size="small" sx={{ flex: '1 1 140px', minWidth: 120 }}>
        <InputLabel>{t('tools.gantt.deps')}</InputLabel>
        <Select
          multiple value={deps} input={<OutlinedInput label={t('tools.gantt.deps')} />}
          onChange={(e) => {
            const value = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
            onChange((x) => ({ ...x, dependencies: value.join(',') }));
          }}
          renderValue={(selected) => `${selected.length}`}
        >
          {others.map((o) => (
            <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <Tooltip title={t('tools.gantt.removeTask')}>
        <span>
          <IconButton size="small" onClick={onRemove} disabled={!canRemove} aria-label={t('tools.gantt.removeTask')}>
            <DeleteOutlined fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </GlassCard>
  );
}

function MyProjects({ isVerified, onOpen, onFeedback }: {
  isVerified: boolean; onOpen: (id: number) => void; onFeedback: (f: Feedback) => void;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<GanttSummary[] | null>(null);
  const [error, setError] = useState(false);

  const reload = () => listMyGanttCharts({ size: 50 }).then((p) => setRows(p.content)).catch(() => setError(true));
  useEffect(() => { if (isVerified) reload(); }, [isVerified]);

  if (!isVerified) return <LoginHint />;

  const remove = async (id: number) => {
    if (!window.confirm(t('tools.gantt.confirmDelete'))) return;
    try { await deleteGanttChart(id); onFeedback({ msg: t('tools.gantt.deleted'), severity: 'success' }); reload(); }
    catch { onFeedback({ msg: t('tools.gantt.saveError'), severity: 'error' }); }
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('tools.gantt.mineIntro')}</Typography>
      {rows === null && !error && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>}
      {error && <Typography color="error">{t('tools.gantt.loadError')}</Typography>}
      {rows?.length === 0 && <Typography color="text.secondary" sx={{ py: 2 }}>{t('tools.gantt.mineEmpty')}</Typography>}
      <Stack spacing={1}>
        {rows?.map((r) => (
          <GlassCard key={r.id} sx={{ p: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 600 }} noWrap>{r.title}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t('tools.gantt.tasksCount', { count: r.taskCount })}
                {r.shared ? ` · ${t('tools.gantt.sharedChip')}` : ''}
              </Typography>
            </Box>
            <Button size="small" variant="contained" onClick={() => onOpen(r.id)}>{t('tools.gantt.open')}</Button>
            <IconButton size="small" color="error" onClick={() => remove(r.id)} aria-label={t('tools.gantt.removeTask')}>
              <DeleteOutlined fontSize="small" />
            </IconButton>
          </GlassCard>
        ))}
      </Stack>
    </Box>
  );
}

function Library({ isVerified, onImport }: { isVerified: boolean; onImport: (id: number) => void }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<GanttSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isVerified) listSharedGanttCharts({ size: 50 }).then((p) => setRows(p.content)).catch(() => setError(true));
  }, [isVerified]);

  if (!isVerified) return <LoginHint />;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('tools.gantt.libraryIntro')}</Typography>
      {rows === null && !error && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>}
      {error && <Typography color="error">{t('tools.gantt.loadError')}</Typography>}
      {rows?.length === 0 && <Typography color="text.secondary" sx={{ py: 2 }}>{t('tools.gantt.libraryEmpty')}</Typography>}
      <Stack spacing={1}>
        {rows?.map((r) => (
          <GlassCard key={r.id} sx={{ p: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 600 }} noWrap>{r.title}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t('tools.gantt.tasksCount', { count: r.taskCount })} · {r.ownerName}
              </Typography>
            </Box>
            {done.has(r.id) ? (
              <Chip size="small" color="success" icon={<Check />} label={t('tools.gantt.imported')} />
            ) : (
              <Button size="small" variant="outlined" startIcon={<CloudDownload />}
                onClick={() => { onImport(r.id); setDone((s) => new Set(s).add(r.id)); }}>
                {t('tools.gantt.importToEditor')}
              </Button>
            )}
          </GlassCard>
        ))}
      </Stack>
    </Box>
  );
}

function LoginHint() {
  const { t } = useTranslation();
  return (
    <GlassCard sx={{ p: 3, textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary">{t('tools.gantt.loginToSave')}</Typography>
    </GlassCard>
  );
}

function triggerBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

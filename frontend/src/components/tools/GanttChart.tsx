import { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, TextField, IconButton, Button, Chip, Stack, Tabs, Tab, Tooltip,
  ToggleButtonGroup, ToggleButton, Select, MenuItem, FormControl, InputLabel,
  Snackbar, Alert, CircularProgress, OutlinedInput, InputAdornment,
} from '@mui/material';
import {
  Add, DeleteOutlined, FileDownload, FileUpload, Image as ImageIcon, Save, CloudUpload,
  CloudDownload, Check, PersonAddAlt1,
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
  workerColor, uid,
} from './gantt/logic';
import Timeline from './gantt/Timeline';

const STORAGE_KEY = 'freenote.gantt.v1';
type Feedback = { msg: string; severity: 'success' | 'error' };

/** Largeur d'un jour (px) par niveau de zoom. */
const ZOOM_WIDTHS = { day: 36, week: 18, month: 9 } as const;
type Zoom = keyof typeof ZOOM_WIDTHS;

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

  const addWorker = (name: string) => {
    const clean = name.trim().slice(0, 60);
    if (!clean) return;
    setProject((prev) => prev.workers.includes(clean) ? prev : { ...prev, workers: [...prev.workers, clean] });
  };
  const removeWorker = (name: string) => setProject((prev) => ({
    ...prev,
    workers: prev.workers.filter((w) => w !== name),
    tasks: prev.tasks.map((task) => (task.assignee === name ? { ...task, assignee: undefined } : task)),
  }));

  const exportJson = () => download(`${project.title || 'gantt'}.json`, projectToJson(project), 'application/json');
  const exportCsv = () => download(`${project.title || 'gantt'}.csv`, toCsv(project), 'text/csv');
  const importJson = async (file: File) => {
    try { setProject({ ...projectFromJson(await file.text()), serverId: undefined, shared: false }); setTab('editor'); }
    catch { setFeedback({ msg: t('tools.gantt.importError'), severity: 'error' }); }
  };

  const toDto = (task: GanttTask): GanttTaskDto => ({ ...task, assignee: task.assignee ?? null });
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
      const tasks: GanttTask[] = res.tasks.map((task) => ({
        id: task.id || uid(),
        name: task.name,
        start: task.start ?? '',
        end: task.end ?? '',
        progress: task.progress,
        dependencies: task.dependencies ?? '',
        assignee: task.assignee ?? undefined,
      }));
      setProject({
        id: uid(),
        title: asCopy ? `${res.title} (copie)` : res.title,
        createdAt: Date.now(),
        tasks,
        // Le serveur ne stocke pas la liste des travailleurs : on la reconstitue des assignés.
        workers: [...new Set(tasks.map((task) => task.assignee).filter((a): a is string => Boolean(a)))],
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
          onAddWorker={addWorker} onRemoveWorker={removeWorker}
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

function Editor({ project, isVerified, onTitle, onAddTask, onSetTask, onRemoveTask, onAddWorker, onRemoveWorker, onExportJson, onExportCsv, onImport, onSave, onShare }: {
  project: GanttProject; isVerified: boolean;
  onTitle: (v: string) => void; onAddTask: () => void;
  onSetTask: (id: string, fn: (t: GanttTask) => GanttTask) => void; onRemoveTask: (id: string) => void;
  onAddWorker: (name: string) => void; onRemoveWorker: (name: string) => void;
  onExportJson: () => void; onExportCsv: () => void; onImport: () => void; onSave: () => void; onShare: () => void;
}) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState<Zoom>('week');
  const [workerDraft, setWorkerDraft] = useState('');
  const chartRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const tasks = renderTasks(project);

  const exportPng = () => {
    const svg = chartRef.current?.querySelector('svg.gantt-svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scale = 2;
    const data = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml' }));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(rect.width * scale));
      canvas.height = Math.max(1, Math.round(rect.height * scale));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => { if (blob) triggerBlob(blob, `${project.title || 'gantt'}.png`); });
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  const namedTasks = project.tasks.filter((task) => task.name.trim());
  const submitWorker = () => { onAddWorker(workerDraft); setWorkerDraft(''); };

  return (
    <Box>
      <TextField
        fullWidth label={t('tools.gantt.projectTitle')} value={project.title}
        onChange={(e) => onTitle(e.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} sx={{ mb: 2 }}
      />

      {/* Travailleurs : la couleur du chip = la couleur des barres assignées. */}
      <GlassCard sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.25 }}>{t('tools.gantt.workersTitle')}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          {t('tools.gantt.workersHint')}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          {project.workers.map((w) => (
            <Chip
              key={w} label={w} size="small" onDelete={() => onRemoveWorker(w)}
              sx={{
                borderColor: workerColor(project.workers, w),
                color: workerColor(project.workers, w),
                fontWeight: 600,
              }}
              variant="outlined"
            />
          ))}
          <TextField
            size="small" value={workerDraft} placeholder={t('tools.gantt.workerPlaceholder')}
            onChange={(e) => setWorkerDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitWorker(); } }}
            sx={{ width: 220 }}
            slotProps={{
              htmlInput: { maxLength: 60 },
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={submitWorker} disabled={!workerDraft.trim()}
                      aria-label={t('tools.gantt.addWorker')}>
                      <PersonAddAlt1 fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>
      </GlassCard>

      {/* Le graphique d'abord : c'est LUI l'éditeur principal (drag = déplacer, poignées = durée). */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1 }}>
        <Typography variant="caption" color="text.secondary">{t('tools.gantt.dragHint')}</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <ToggleButtonGroup size="small" exclusive value={zoom} onChange={(_, v) => v && setZoom(v)}>
          <ToggleButton value="day">{t('tools.gantt.viewDay')}</ToggleButton>
          <ToggleButton value="week">{t('tools.gantt.viewWeek')}</ToggleButton>
          <ToggleButton value="month">{t('tools.gantt.viewMonth')}</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <GlassCard sx={{ p: 1.5, mb: 2 }}>
        {tasks.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            {t('tools.gantt.emptyChart')}
          </Typography>
        ) : (
          <Box ref={chartRef}>
            <Timeline
              tasks={tasks}
              workers={project.workers}
              dayWidth={ZOOM_WIDTHS[zoom]}
              onChange={(id, p) => onSetTask(id, (x) => ({ ...x, ...p }))}
              onSelect={() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
            />
          </Box>
        )}
      </GlassCard>

      {/* La table des tâches : détails précis (dates exactes, %, dépendances, assigné). */}
      <Stack spacing={1.25} sx={{ mb: 2 }} ref={tableRef}>
        {project.tasks.map((task, i) => (
          <TaskRow
            key={task.id} task={task} index={i} others={namedTasks.filter((o) => o.id !== task.id)}
            workers={project.workers}
            onChange={(fn) => onSetTask(task.id, fn)} onRemove={() => onRemoveTask(task.id)}
            canRemove={project.tasks.length > 1}
          />
        ))}
      </Stack>

      <Button startIcon={<Add />} variant="outlined" onClick={onAddTask} sx={{ mb: 2 }}>{t('tools.gantt.addTask')}</Button>

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

function TaskRow({ task, index, others, workers, onChange, onRemove, canRemove }: {
  task: GanttTask; index: number; others: GanttTask[]; workers: string[];
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
      <FormControl size="small" sx={{ width: 150 }}>
        <InputLabel>{t('tools.gantt.assignee')}</InputLabel>
        <Select
          value={task.assignee ?? ''} label={t('tools.gantt.assignee')}
          onChange={(e) => onChange((x) => ({ ...x, assignee: e.target.value || undefined }))}
        >
          <MenuItem value="">{t('tools.gantt.noAssignee')}</MenuItem>
          {workers.map((w) => (
            <MenuItem key={w} value={w}>
              <Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', bgcolor: workerColor(workers, w), mr: 1 }} />
              {w}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
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
